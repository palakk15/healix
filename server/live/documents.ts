import { inflateRawSync } from "node:zlib";
import type { ReaderPage, ReaderWord } from "./extract";

export type DocumentKind = "pdf" | "image" | "docx" | "text";

export const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const extensionMimes: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  txt: "text/plain",
  text: "text/plain",
  csv: "text/plain",
  md: "text/plain",
  docx: docxMime,
};

export function normaliseMime(name: string, mime: string): string {
  const clean = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (clean && clean !== "application/octet-stream" && clean !== "application/x-unknown") return clean === "image/jpg" ? "image/jpeg" : clean;
  const extension = name.toLowerCase().split(".").pop() ?? "";
  return extensionMimes[extension] ?? clean;
}

export function kindOf(mime: string): DocumentKind | null {
  if (mime === "application/pdf") return "pdf";
  if (/^image\/(png|jpeg|webp|gif|bmp|tiff)$/.test(mime)) return "image";
  if (mime === docxMime) return "docx";
  if (mime === "text/plain" || mime === "text/csv" || mime === "text/markdown") return "text";
  return null;
}

export function extensionFor(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/bmp":
      return ".bmp";
    case "image/tiff":
      return ".tif";
    case docxMime:
      return ".docx";
    case "text/plain":
    case "text/csv":
    case "text/markdown":
      return ".txt";
    default:
      return ".jpg";
  }
}

export function readZipEntry(zip: Buffer, wanted: string): Buffer | null {
  let end = -1;
  for (let index = zip.length - 22; index >= Math.max(0, zip.length - 65_557); index -= 1) {
    if (zip.readUInt32LE(index) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) return null;
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  for (let entry = 0; entry < count; entry += 1) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const localName = zip.readUInt16LE(localOffset + 26);
      const localExtra = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localName + localExtra;
      const data = zip.subarray(start, start + compressedSize);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

export function docxText(bytes: Buffer): string {
  const xml = readZipEntry(bytes, "word/document.xml");
  if (!xml) throw new Error("unreadable_file");
  return decodeEntities(
    xml
      .toString("utf8")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<\/w:(?:p|tr)>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

export function pagesFromText(text: string): ReaderPage[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      words: line
        .split(/[\s\t]+/)
        .filter(Boolean)
        .map((word): ReaderWord => ({ text: word, confidence: 100, bbox: [0, 0, 0, 0] })),
    }));
  return [{ width: 1000, height: 1000, lines }];
}
