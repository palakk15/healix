import { describe, expect, it } from "vitest";
import { buildRangeBar } from "./reportRange";
import { layoutSegments, valuePercent } from "./rangeBar";
import { normalizeFollowUps, reasoningStepKinds } from "./triage";

describe("follow-up normalisation", () => {
  it("turns plain strings into yes and no chips in the patient's language", () => {
    expect(normalizeFollowUps(["Is it sudden?"], "mr")).toEqual([{ question: "Is it sudden?", options: ["हो", "नाही"] }]);
    expect(normalizeFollowUps(["Is it sudden?"], "hinglish")[0]?.options).toEqual(["Haan", "Nahi"]);
  });

  it("keeps the options the AI service sent", () => {
    expect(normalizeFollowUps([{ question: "q", options: ["A", "B", "C"] }], "en")[0]?.options).toEqual(["A", "B", "C"]);
    expect(normalizeFollowUps([{ question: "q" }], "en")[0]?.options).toEqual(["Yes", "No"]);
  });
});

describe("reasoning step kinds", () => {
  it("marks the first step as input, the last as conclusion and the middle as safety", () => {
    expect(reasoningStepKinds(3)).toEqual(["input", "safety", "conclusion"]);
    expect(reasoningStepKinds(1)).toEqual(["input"]);
    expect(reasoningStepKinds(5)).toEqual(["input", "safety", "safety", "safety", "conclusion"]);
    expect(reasoningStepKinds(0)).toEqual([]);
  });
});

describe("range bars from a report's own reference range", () => {
  it("builds ok, watch and out zones around a two-sided range and places the value", () => {
    const bar = buildRangeBar({ low: 70, high: 99 }, 132);
    expect(bar.segments.map((segment) => segment.tone)).toEqual(["out", "watch", "ok", "watch", "out"]);
    const boundaries = bar.segments.map((segment) => segment.to);
    expect(boundaries).toEqual([...boundaries].sort((a, b) => a - b));
    expect(bar.max).toBeGreaterThan(132);
    const percent = valuePercent(132, bar.min, bar.max);
    expect(percent).toBeGreaterThan(50);
    expect(percent).toBeLessThan(100);
    const shares = layoutSegments(bar.segments, bar.min, bar.max);
    expect(shares.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1, 5);
  });

  it("handles upper-only ranges such as cholesterol below 200", () => {
    const bar = buildRangeBar({ low: 0, high: 200 }, 214);
    expect(bar.min).toBe(0);
    expect(bar.segments[0]?.tone).toBe("ok");
    expect(bar.segments.at(-1)?.tone).toBe("out");
    expect(bar.max).toBeGreaterThan(214);
  });

  it("keeps a normal value inside the ok zone", () => {
    const bar = buildRangeBar({ low: 12, high: 15.5 }, 12.8);
    const okEnd = bar.segments.find((segment) => segment.tone === "ok")?.to ?? 0;
    expect(12.8).toBeLessThan(okEnd);
    expect(12.8).toBeGreaterThan(12);
  });

  it("widens the bar so a very low value never leaves it", () => {
    const bar = buildRangeBar({ low: 30, high: 100 }, 18);
    expect(bar.min).toBeLessThanOrEqual(18);
    expect(valuePercent(18, bar.min, bar.max)).toBeGreaterThan(0);
    expect(valuePercent(18, bar.min, bar.max)).toBeLessThan(40);
  });

  it("widens the bar so a very high value never leaves it", () => {
    const bar = buildRangeBar({ low: 4, high: 5.6 }, 12);
    expect(bar.max).toBeGreaterThanOrEqual(12);
  });
});
