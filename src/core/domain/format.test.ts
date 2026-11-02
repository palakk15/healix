import { describe, expect, it } from "vitest";
import { formatIndiaTime, formatMinutes, formatRupees, formatSignedMinutes } from "./format";

describe("formatting", () => {
  it("groups rupees the Indian way", () => {
    expect(formatRupees(150000)).toBe("₹1,50,000");
    expect(formatRupees(800)).toBe("₹800");
  });

  it("shows UTC times in Asia/Kolkata with 12-hour clock", () => {
    expect(formatIndiaTime("2026-11-01T05:05:00Z")).toBe("10:35 AM");
  });

  it("formats minutes and signed deltas", () => {
    expect(formatMinutes(24.6)).toBe("25 min");
    expect(formatSignedMinutes(12)).toBe("+12m");
    expect(formatSignedMinutes(-6)).toBe("−6m");
  });
});
