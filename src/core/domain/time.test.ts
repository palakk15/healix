import { describe, expect, it } from "vitest";
import { addDaysToDateKey, formatClockLabel, istDateKey, istMinutesOfDay, istParts, istTimeToDate } from "./time";

describe("India time helpers", () => {
  it("reads IST parts from a UTC instant", () => {
    const parts = istParts(new Date("2026-11-02T04:40:00.000Z"));
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 2, hour: 10, minute: 10, weekday: 1 });
  });

  it("rolls the date over at IST midnight, not UTC midnight", () => {
    expect(istDateKey(new Date("2026-11-01T18:29:00.000Z"))).toBe("2026-11-01");
    expect(istDateKey(new Date("2026-11-01T18:31:00.000Z"))).toBe("2026-11-02");
  });

  it("converts an IST wall time back to UTC", () => {
    expect(istTimeToDate("2026-11-02", "10:35").toISOString()).toBe("2026-11-02T05:05:00.000Z");
    expect(istMinutesOfDay(istTimeToDate("2026-11-02", "10:35"))).toBe(635);
  });

  it("adds days and formats clock labels", () => {
    expect(addDaysToDateKey("2026-11-30", 1)).toBe("2026-12-01");
    expect(formatClockLabel(11, 20)).toBe("11:20 AM");
    expect(formatClockLabel(0, 5)).toBe("12:05 AM");
    expect(formatClockLabel(13, 0)).toBe("1:00 PM");
  });
});
