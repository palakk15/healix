import type { Observation } from "@core/api/schemas/ai";
import type { ExtractedReport } from "../mock/reports";
import { interpret } from "../mock/reports";
import { analytes, reportTypeFor, type Analyte } from "./analytes";

export interface ReaderWord {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface ReaderLine {
  words: ReaderWord[];
}

export interface ReaderPage {
  width: number;
  height: number;
  lines: ReaderLine[];
}

const numberPattern = /^[<>≤≥]?\d+(?:[.,]\d+)?$/;
const repairedConfidence = 0.55;
const defaultRangeConfidence = 0.75;

function cleanNumber(text: string): string {
  return text.replace(/[^\d.,<>≤≥]/g, "").replace(",", ".");
}

function parseNumber(text: string): number | null {
  const cleaned = cleanNumber(text).replace(/^[<>≤≥]/, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function repairDecimal(text: string, plausible: [number, number]): { value: number; repaired: boolean } | null {
  const cleaned = cleanNumber(text).replace(/^[<>≤≥]/, "");
  const direct = parseNumber(cleaned);
  if (direct === null) return null;
  const [low, high] = plausible;
  if (direct >= low && direct <= high) return { value: direct, repaired: false };
  if (cleaned.includes(".")) return null;
  for (let position = 1; position < cleaned.length; position += 1) {
    const candidate = Number(`${cleaned.slice(0, position)}.${cleaned.slice(position)}`);
    if (candidate >= low && candidate <= high) return { value: candidate, repaired: true };
  }
  return null;
}

function normaliseLine(words: ReaderWord[]): { text: string; starts: number[] } {
  const starts: number[] = [];
  let text = "";
  for (const word of words) {
    starts.push(text.length);
    text += `${word.text} `;
  }
  return { text, starts };
}

interface ParsedRange {
  low: number | null;
  high: number | null;
}

function parseRange(texts: readonly string[], analyte: Analyte): ParsedRange | null {
  const joined = texts.join(" ").replace(/[–—]/g, "-");
  const span = joined.match(/(\d+(?:[.,]\d+)?)\s*(?:-|to)\s*(\d+(?:[.,]\d+)?)/i);
  const wide: [number, number] = [0, analyte.plausible[1] * 1.5];
  if (span?.[1] && span[2]) {
    const low = repairDecimal(span[1], wide) ?? { value: parseNumber(span[1]) ?? 0, repaired: false };
    let high = repairDecimal(span[2], wide) ?? { value: parseNumber(span[2]) ?? 0, repaired: false };
    if (high.value <= low.value) {
      const retry = repairDecimal(span[2], [low.value, analyte.plausible[1] * 1.5]);
      if (retry) high = retry;
    }
    if (high.value > low.value) return { low: low.value, high: high.value };
  }
  const upper = joined.match(/[<≤]\s*(\d+(?:[.,]\d+)?)/);
  if (upper?.[1]) {
    const parsed = repairDecimal(upper[1], wide);
    if (parsed) return { low: 0, high: parsed.value };
  }
  const lower = joined.match(/[>≥]\s*(\d+(?:[.,]\d+)?)/);
  if (lower?.[1]) {
    const parsed = repairDecimal(lower[1], wide);
    if (parsed) return { low: parsed.value, high: null };
  }
  return null;
}

function fitToRange(raw: string, value: number, reference: ParsedRange): number | null {
  const { low, high } = reference;
  if (high === null && (low === null || low === 0)) return null;
  const upper = high ?? (low ?? 0) * 3;
  const lower = low !== null && low > 0 ? low : 0;
  if (value <= upper * 3 && (lower === 0 || value >= lower / 3)) return null;
  const cleaned = cleanNumber(raw).replace(/^[<>≤≥]/, "");
  if (cleaned.includes(".")) return null;
  for (let position = 1; position < cleaned.length; position += 1) {
    const candidate = Number(`${cleaned.slice(0, position)}.${cleaned.slice(position)}`);
    if (candidate <= upper * 3 && (lower === 0 || candidate >= lower / 3)) return candidate;
  }
  return null;
}

function parseLine(line: ReaderLine, page: ReaderPage): Observation | null {
  if (line.words.length < 2) return null;
  const { text, starts } = normaliseLine(line.words);
  const matched = analytes.find((candidate) => candidate.pattern.test(text));
  if (!matched) return null;
  const match = text.match(matched.pattern);
  if (!match || match.index === undefined) return null;
  const end = match.index + match[0].length;
  const after = line.words.filter((_, index) => (starts[index] ?? 0) >= end);
  const valueIndex = after.findIndex((word) => numberPattern.test(cleanNumber(word.text)) && /\d/.test(word.text));
  const valueWord = after[valueIndex];
  if (!valueWord) return null;

  const parsed = repairDecimal(valueWord.text, matched.plausible) ?? (matched.scale ? repairDecimal(String(Number(cleanNumber(valueWord.text)) / matched.scale.divideBy), matched.plausible) : null);
  if (!parsed) return null;
  let value = parsed.value;
  if (matched.scale && value >= matched.scale.above) value = Math.round((value / matched.scale.divideBy) * 100) / 100;

  const rest = after.slice(valueIndex + 1).map((word) => word.text);
  const range = parseRange(rest.filter((word) => !/^[HL*]$/i.test(word)), matched);
  const fromReport = range !== null;
  const reference = range ?? matched.defaultRange ?? { low: null, high: null };

  let repaired = parsed.repaired;
  const fitted = fitToRange(valueWord.text, value, reference);
  if (fitted !== null && fitted !== value) {
    value = fitted;
    repaired = true;
  }

  let confidence = Math.min(Math.max(valueWord.confidence / 100, 0), 1);
  if (repaired) confidence = Math.min(confidence, repairedConfidence);
  if (!fromReport) confidence = Math.min(confidence, defaultRangeConfidence);

  const [x0, y0, x1, y1] = valueWord.bbox;
  const bbox: [number, number, number, number] = [
    Math.round((x0 / page.width) * 10_000) / 10_000,
    Math.round((y0 / page.height) * 10_000) / 10_000,
    Math.round(((x1 - x0) / page.width) * 10_000) / 10_000,
    Math.round(((y1 - y0) / page.height) * 10_000) / 10_000,
  ];

  return {
    code: matched.code,
    display: matched.display,
    value,
    unit: matched.unit,
    reference: { low: reference.low, high: reference.high },
    interpretation: interpret(value, reference.low, reference.high),
    confidence: Math.round(confidence * 100) / 100,
    bbox,
  };
}

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function findReportDate(text: string, nowMs: number): number | null {
  const numeric = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  const named = text.match(/\b(\d{1,2})[\s-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]+(\d{4})\b/i);
  let day: number;
  let month: number;
  let year: number;
  if (numeric?.[1] && numeric[2] && numeric[3]) {
    day = Number(numeric[1]);
    month = Number(numeric[2]) - 1;
    year = Number(numeric[3]);
  } else if (named?.[1] && named[2] && named[3]) {
    day = Number(named[1]);
    month = monthNames.indexOf(named[2].toLowerCase());
    year = Number(named[3]);
  } else {
    return null;
  }
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const at = Date.UTC(year, month, day, 6, 30);
  if (at > nowMs + 86_400_000 || at < nowMs - 3 * 365 * 86_400_000) return null;
  return at;
}

const headings: Array<[RegExp, string]> = [
  [/diabet|glyc(?:ated|osylated)|blood\s+sugar/i, "Diabetes check-up"],
  [/lipid/i, "Lipid profile"],
  [/complete\s+blood\s+count|\bcbc\b|h(?:a)?emogram/i, "Complete blood count"],
  [/thyroid/i, "Thyroid"],
  [/kidney|renal/i, "Kidney function"],
  [/liver/i, "Liver function"],
  [/vitamin/i, "Vitamins"],
];

function headingTitle(pages: readonly ReaderPage[]): string | null {
  const first = pages[0];
  if (!first) return null;
  for (const line of first.lines.slice(0, 12)) {
    const text = line.words.map((word) => word.text).join(" ");
    if (/\d/.test(text) && !/check-?up|profile|panel|test/i.test(text)) continue;
    if (!/check-?up|profile|panel|count|screen|function|test|vitamin/i.test(text)) continue;
    const hit = headings.find(([pattern]) => pattern.test(text));
    if (hit) return hit[1];
  }
  return null;
}

export function extractFromPages(pages: readonly ReaderPage[], nowMs: number): ExtractedReport {
  const found = new Map<string, Observation>();
  for (const page of pages) {
    for (const line of page.lines) {
      const observation = parseLine(line, page);
      if (!observation) continue;
      const existing = found.get(observation.code);
      if (!existing || observation.confidence > existing.confidence) found.set(observation.code, observation);
    }
  }
  const observations = [...found.values()];
  const firstPage = pages[0];
  const allText = pages.flatMap((page) => page.lines.map((line) => line.words.map((word) => word.text).join(" "))).join("\n");
  const labLine = firstPage?.lines.map((line) => line.words.map((word) => word.text).join(" ").trim()).find((text) => /[A-Za-z]{4,}/.test(text) && !/^(patient|name|age|sex|date)/i.test(text));
  return {
    labName: (labLine ?? "Uploaded report").slice(0, 80),
    reportType: headingTitle(pages) ?? reportTypeFor(observations.map((entry) => entry.code)),
    issuedAtMs: findReportDate(allText, nowMs),
    observations,
    rawText: allText.slice(0, 20000),
  };
}
