import { createRequire } from "node:module";
import type * as canvasTypes from "@napi-rs/canvas";
import { dirname, resolve } from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import type { ExtractedReport } from "../mock/reports";
import { docxText, kindOf, normaliseMime, pagesFromText } from "./documents";
import { extractFromPages, type ReaderLine, type ReaderPage, type ReaderWord } from "./extract";

const require = createRequire(import.meta.url);

let workerPromise: Promise<Worker> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function languageDirectory(): string {
  return resolve(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
}

function getWorker(cacheDirectory: string): Promise<Worker> {
  workerPromise ??= createWorker("eng", 1, { langPath: languageDirectory(), gzip: true, cachePath: cacheDirectory, errorHandler: () => undefined });
  return workerPromise;
}

export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1] ?? 0;
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export function looksLikeImage(bytes: Buffer): boolean {
  if (imageSize(bytes)) return true;
  return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

interface TesseractWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractData {
  blocks?: Array<{ paragraphs: Array<{ lines: Array<{ words: TesseractWord[] }> }> }> | null;
}

export async function readImagePages(bytes: Buffer, cacheDirectory: string): Promise<ReaderPage[]> {
  const run = async (): Promise<ReaderPage[]> => {
    const worker = await getWorker(cacheDirectory);
    const result = await worker.recognize(bytes, {}, { blocks: true });
    const data = result.data as unknown as TesseractData;
    const lines: ReaderLine[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.map((line) => ({
          words: line.words.map((word): ReaderWord => ({ text: word.text, confidence: word.confidence, bbox: [word.bbox.x0, word.bbox.y0, word.bbox.x1, word.bbox.y1] })),
        })),
      ),
    );
    const size = imageSize(bytes);
    const width = size?.width ?? Math.max(1, ...lines.flatMap((line) => line.words.map((word) => word.bbox[2]))) * 1.05;
    const height = size?.height ?? Math.max(1, ...lines.flatMap((line) => line.words.map((word) => word.bbox[3]))) * 1.05;
    return [{ width, height, lines }];
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export async function readPdfPages(bytes: Buffer): Promise<ReaderPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages: ReaderPage[] = [];
  const count = Math.min(document.numPages, maxTextPages);
  for (let number = 1; number <= count; number += 1) {
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const rows = new Map<number, ReaderWord[]>();
    for (const item of content.items as unknown as PdfTextItem[]) {
      if (typeof item.str !== "string" || item.str.trim() === "") continue;
      const top = viewport.height - (item.transform[5] ?? 0) - item.height;
      const key = Math.round(top / 3);
      const tokens = item.str.split(/\s+/).filter(Boolean);
      const totalChars = item.str.length || 1;
      let consumed = 0;
      for (const token of tokens) {
        const offset = item.str.indexOf(token, consumed);
        const start = (item.transform[4] ?? 0) + (offset / totalChars) * item.width;
        const wide = (token.length / totalChars) * item.width;
        consumed = offset + token.length;
        const words = rows.get(key) ?? [];
        words.push({ text: token, confidence: 100, bbox: [start, top, start + wide, top + item.height] });
        rows.set(key, words);
      }
    }
    const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, words]) => ({ words: words.sort((a, b) => a.bbox[0] - b.bbox[0]) }));
    pages.push({ width: viewport.width, height: viewport.height, lines });
  }
  return pages;
}

type CanvasModule = typeof canvasTypes;

const maxTextPages = 25;
const maxScannedPages = 8;
const maxRawText = 120_000;

async function renderPdfPages(bytes: Buffer, cacheDirectory: string): Promise<ReaderPage[]> {
  let canvasModule: CanvasModule;
  try {
    canvasModule = await import("@napi-rs/canvas");
  } catch {
    throw new Error("scanned_pdf");
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages: ReaderPage[] = [];
  const count = Math.min(document.numPages, maxScannedPages);
  for (let number = 1; number <= count; number += 1) {
    const page = await document.getPage(number);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context as unknown as CanvasRenderingContext2D, viewport }).promise;
    pages.push(...(await readImagePages(canvas.toBuffer("image/png"), cacheDirectory)));
  }
  return pages;
}

export function createReportReader(cacheDirectory: string) {
  return async (bytes: Buffer, mimeType: string, name = ""): Promise<ExtractedReport> => {
    const mime = normaliseMime(name, mimeType);
    const kind = kindOf(mime);
    if (!kind) throw new Error("unreadable_file");
    let pages: ReaderPage[];
    let textOnly = false;
    if (kind === "pdf") {
      pages = await readPdfPages(bytes);
      if (pages.every((page) => page.lines.length === 0)) pages = await renderPdfPages(bytes, cacheDirectory);
    } else if (kind === "image") {
      if (!looksLikeImage(bytes) && !/^image\/(gif|bmp|tiff)$/.test(mime)) throw new Error("unreadable_image");
      pages = await readImagePages(bytes, cacheDirectory);
    } else {
      textOnly = true;
      pages = pagesFromText((kind === "docx" ? docxText(bytes) : bytes.toString("utf8", 0, 2_000_000)).slice(0, 2_000_000));
    }
    const result = extractFromPages(pages, Date.now());
    const readable = (result.rawText ?? "").replace(/\s+/g, " ").trim();
    if (readable.length < 15 && result.observations.length === 0) throw new Error("no_text_found");
    return {
      ...result,
      observations: textOnly ? result.observations.map((entry) => ({ ...entry, bbox: undefined })) : result.observations,
      rawText: (result.rawText ?? "").slice(0, maxRawText),
    };
  };
}

export async function stopReader(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
