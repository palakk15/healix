import { describe, expect, it } from "vitest";
import { layoutSegments, valuePercent } from "./rangeBar";

describe("range bar maths", () => {
  it("turns boundaries into shares of the range", () => {
    const layout = layoutSegments(
      [
        { to: 5.7, tone: "ok" },
        { to: 6.5, tone: "watch" },
        { to: 10, tone: "out" },
      ],
      4,
      10,
    );
    expect(layout.map((item) => item.tone)).toEqual(["ok", "watch", "out"]);
    expect(layout[0]?.share).toBeCloseTo(0.283, 2);
    expect(layout[1]?.share).toBeCloseTo(0.133, 2);
    expect(layout[2]?.share).toBeCloseTo(0.583, 2);
    expect(layout.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1, 5);
  });

  it("places the value as a clamped percentage", () => {
    expect(valuePercent(7.1, 4, 10)).toBeCloseTo(51.67, 1);
    expect(valuePercent(-3, 0, 10)).toBe(0);
    expect(valuePercent(99, 0, 10)).toBe(100);
  });

  it("returns nothing for an empty range", () => {
    expect(layoutSegments([{ to: 1, tone: "ok" }], 5, 5)).toEqual([]);
    expect(valuePercent(3, 5, 5)).toBe(0);
  });
});
