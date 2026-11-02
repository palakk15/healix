import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { extractFromPages, findReportDate, repairDecimal, type ReaderLine, type ReaderPage } from "./extract";
import { createReportReader, imageSize, stopReader } from "./reader";

const reports = resolve(import.meta.dirname, "../mock/data/reports");
const word = (text: string, x: number, confidence = 95) => ({ text, bbox: [x, 100, x + 40, 112] as [number, number, number, number], confidence });
const line = (...entries: Array<[string, number?, number?]>): ReaderLine => ({ words: entries.map(([text, x, confidence], index) => word(text, x ?? 50 + index * 90, confidence)) });
const page = (...lines: ReaderLine[]): ReaderPage => ({ width: 800, height: 1000, lines });
const NOW = Date.UTC(2026, 10, 1);

describe("decimal repair", () => {
  it("restores a dropped decimal point only when the number is implausible", () => {
    expect(repairDecimal("71", [3, 20])).toEqual({ value: 7.1, repaired: true });
    expect(repairDecimal("132", [30, 600])).toEqual({ value: 132, repaired: false });
    expect(repairDecimal("7,1", [3, 20])).toEqual({ value: 7.1, repaired: false });
    expect(repairDecimal("abc", [3, 20])).toBeNull();
    expect(repairDecimal("0", [3, 20])).toBeNull();
  });
});

describe("extractFromPages", () => {
  it("reads value, range, unit and box, and marks a repaired value as low confidence", () => {
    const result = extractFromPages([page(line(["Lab", 50], ["Name", 140]), line(["HbA1c", 50], ["71", 300, 91], ["H", 400], ["%", 450], ["4-56", 520]))], NOW);
    const observation = result.observations[0];
    expect(observation).toMatchObject({ code: "HBA1C", value: 7.1, unit: "%", reference: { low: 4, high: 5.6 }, interpretation: "high" });
    expect(observation?.confidence).toBeLessThan(0.8);
    expect(observation?.bbox).toEqual([0.375, 0.1, 0.05, 0.012]);
  });

  it("fits a value to its own range when OCR drops the point on a plausible number", () => {
    const result = extractFromPages([page(line(["WBC", 50], ["72", 200], ["%", 300], ["4.0", 350], ["-", 400], ["11.0", 420]))], NOW);
    expect(result.observations[0]).toMatchObject({ code: "WBC", value: 7.2, unit: "×10³/µL" });
    expect(result.observations[0]?.confidence).toBeLessThan(0.8);
  });

  it("scales counts reported per cubic millimetre", () => {
    const result = extractFromPages([page(line(["Total", 50], ["WBC", 120], ["count", 190], ["7200", 260], ["cells/cumm", 330], ["4000", 420], ["-", 480], ["11000", 500]))], NOW);
    expect(result.observations[0]?.value).toBe(7.2);
  });

  it("falls back to a usual range when the report prints none, and asks for a check", () => {
    const result = extractFromPages([page(line(["Vitamin", 50], ["D", 120], ["18", 220], ["ng/mL", 300]))], NOW);
    expect(result.observations[0]).toMatchObject({ code: "VITD", value: 18, reference: { low: 30, high: 100 }, interpretation: "critical" });
    expect(result.observations[0]?.confidence).toBeLessThanOrEqual(0.75);
  });

  it("keeps the best reading when a test appears twice, and ignores unknown lines", () => {
    const result = extractFromPages(
      [page(line(["Hemoglobin", 50], ["12.5", 200, 60], ["g/dL", 280], ["12-15.5", 360]), line(["Haemoglobin", 50], ["12.8", 200, 98], ["g/dL", 280], ["12-15.5", 360]), line(["Colour", 50], ["Yellow", 200]))],
      NOW,
    );
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]?.value).toBe(12.8);
  });

  it("names the lab from the first line and the type from the heading", () => {
    const result = extractFromPages(
      [page(line(["Green", 50], ["Valley", 120], ["Diagnostics", 190]), line(["LIPID", 50], ["PROFILE", 120]), line(["Total", 50], ["Cholesterol", 120], ["224", 260], ["mg/dL", 320], ["<200", 400]))],
      NOW,
    );
    expect(result.labName).toBe("Green Valley Diagnostics");
    expect(result.reportType).toBe("Lipid profile");
  });

  it("returns nothing for a page with no known tests", () => {
    expect(extractFromPages([page(line(["Hello", 50], ["world", 120]))], NOW).observations).toEqual([]);
  });
});

describe("report dates", () => {
  it("reads numeric and named dates and rejects the future and the very old", () => {
    expect(findReportDate("Collected 12/09/2026", NOW)).toBe(Date.UTC(2026, 8, 12, 6, 30));
    expect(findReportDate("Date: 5 Mar 2026", NOW)).toBe(Date.UTC(2026, 2, 5, 6, 30));
    expect(findReportDate("Date 12/09/2031", NOW)).toBeNull();
    expect(findReportDate("Date 12/09/2001", NOW)).toBeNull();
    expect(findReportDate("no date here", NOW)).toBeNull();
  });
});

describe("image size", () => {
  it("reads PNG dimensions from the header", () => {
    expect(imageSize(readFileSync(resolve(reports, "cbc.png")))).toEqual({ width: 794, height: 1123 });
    expect(imageSize(Buffer.from("not an image"))).toBeNull();
  });
});

describe("reading real files", () => {
  const read = createReportReader(resolve(import.meta.dirname, "../../node_modules/.cache/healix-ocr"));
  afterAll(async () => stopReader());

  const expected: Record<string, Record<string, number>> = {
    "diabetes-panel.png": { HBA1C: 7.1, FBS: 132, TC: 214, TG: 148 },
    "cbc.png": { HB: 12.8, WBC: 7.2, PLT: 245, RBC: 4.5 },
    "vitamin-d.png": { VITD: 18 },
    "june-diabetes.png": { HBA1C: 7.9, FBS: 148 },
    "lipid.png": { TC: 208, TG: 162 },
  };

  for (const [file, values] of Object.entries(expected)) {
    it(`reads every value in ${file}`, async () => {
      const result = await read(readFileSync(resolve(reports, file)), "image/png");
      expect(Object.fromEntries(result.observations.map((entry) => [entry.code, entry.value]))).toEqual(values);
      for (const entry of result.observations) {
        expect(entry.bbox).toBeDefined();
        expect(entry.bbox?.every((part) => part >= 0 && part <= 1)).toBe(true);
      }
    }, 60_000);
  }

  it("reads a PDF that has a text layer, with exact confidence", async () => {
    const result = await read(readFileSync(resolve(reports, "text-lipid.pdf")), "application/pdf");
    expect(result.labName).toBe("Riverside Pathology Lab");
    expect(result.reportType).toBe("Lipid profile");
    expect(Object.fromEntries(result.observations.map((entry) => [entry.code, entry.value]))).toEqual({ TC: 224, TG: 128, HDL: 38, LDL: 160 });
    expect(result.observations.find((entry) => entry.code === "HDL")).toMatchObject({ interpretation: "low", confidence: 1, reference: { low: 40, high: 60 } });
  }, 60_000);
});
