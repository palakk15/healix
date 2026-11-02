import { describe, expect, it } from "vitest";
import type { Observation } from "../api/schemas/ai";
import { allValues, changedValues, draftFrom, invalidCodes, isLowConfidence, parchiText, parseValueInput, splitExplainItems } from "./reportView";

const observation = (code: string, value: number, confidence = 0.97): Observation => ({
  code,
  display: code,
  value,
  unit: "mg/dL",
  reference: { low: 70, high: 99 },
  interpretation: "high",
  confidence,
});

describe("report values", () => {
  it("marks values the reader was unsure about", () => {
    expect(isLowConfidence({ confidence: 0.58 })).toBe(true);
    expect(isLowConfidence({ confidence: 0.8 })).toBe(false);
  });

  it("reads typed numbers, including a decimal comma, and rejects the rest", () => {
    expect(parseValueInput("132")).toBe(132);
    expect(parseValueInput(" 7,1 ")).toBe(7.1);
    expect(parseValueInput("")).toBeNull();
    expect(parseValueInput("abc")).toBeNull();
    expect(parseValueInput("-4")).toBeNull();
    expect(parseValueInput("1e3")).toBeNull();
  });

  it("finds invalid and changed entries", () => {
    const observations = [observation("FBS", 152, 0.58), observation("TC", 214)];
    const draft = { ...draftFrom(observations), FBS: "132", TC: "x" };
    expect(invalidCodes(draft)).toEqual(["TC"]);
    expect(changedValues(observations, draft)).toEqual([{ code: "FBS", value: 132 }]);
    expect(allValues(observations, draft)).toEqual([{ code: "FBS", value: 132 }]);
  });

  it("splits explained items, with the biggest distance first", () => {
    const { flagged, normal } = splitExplainItems([
      { code: "A", meaning: "", direction: "normal", distance: 0 },
      { code: "B", meaning: "", direction: "high", distance: 0.2 },
      { code: "C", meaning: "", direction: "low", distance: 0.9 },
    ]);
    expect(flagged.map((item) => item.code)).toEqual(["C", "B"]);
    expect(normal.map((item) => item.code)).toEqual(["A"]);
  });

  it("numbers the questions on the parchi", () => {
    expect(parchiText("Questions", ["One?", "Two?"])).toBe("Questions\n\n1. One?\n2. Two?");
  });
});
