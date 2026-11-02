import { describe, expect, it } from "vitest";
import type { SlotsResponse } from "../api/schemas/backend";
import { inWindow, isTimeWindow, isVisitPurpose, pickSlot } from "./bookingForm";

const slot = (date: string, time: string, available = true) => ({
  start: new Date(`${date}T${time}:00+05:30`).toISOString(),
  end: new Date(`${date}T${time}:00+05:30`).toISOString(),
  available,
});

const days: SlotsResponse["days"] = [
  { date: "2026-11-02", label: "today", slots: [slot("2026-11-02", "09:00", false), slot("2026-11-02", "14:20")] },
  { date: "2026-11-03", label: "tomorrow", slots: [slot("2026-11-03", "09:40"), slot("2026-11-03", "17:00")] },
  { date: "2026-11-05", label: "later", slots: [] },
];

describe("slot windows", () => {
  it("places a time in the morning, afternoon or evening in India time", () => {
    expect(inWindow(slot("2026-11-02", "09:00").start, "morning")).toBe(true);
    expect(inWindow(slot("2026-11-02", "12:00").start, "morning")).toBe(false);
    expect(inWindow(slot("2026-11-02", "14:20").start, "afternoon")).toBe(true);
    expect(inWindow(slot("2026-11-02", "17:00").start, "evening")).toBe(true);
    expect(inWindow(slot("2026-11-02", "03:00").start, "any")).toBe(true);
  });

  it("recognises valid values from a link", () => {
    expect(isTimeWindow("evening")).toBe(true);
    expect(isTimeWindow("night")).toBe(false);
    expect(isVisitPurpose("followUp")).toBe(true);
    expect(isVisitPurpose(null)).toBe(false);
  });
});

describe("pickSlot", () => {
  it("takes a free time inside the chosen window on the chosen date", () => {
    expect(pickSlot(days, "2026-11-02", "afternoon")).toMatchObject({ date: "2026-11-02", exactDate: true, exactWindow: true });
  });

  it("keeps the chosen date and says the window did not fit when only other times are free", () => {
    expect(pickSlot(days, "2026-11-02", "morning")).toMatchObject({ date: "2026-11-02", exactDate: true, exactWindow: false });
  });

  it("moves to a later day with a matching time when the chosen day has none", () => {
    const empty: SlotsResponse["days"] = [{ date: "2026-11-02", label: "today", slots: [slot("2026-11-02", "09:00", false)] }, ...days.slice(1)];
    expect(pickSlot(empty, "2026-11-02", "evening")).toMatchObject({ date: "2026-11-03", exactDate: false, exactWindow: true });
  });

  it("returns nothing when no time is free anywhere", () => {
    expect(pickSlot([{ date: "2026-11-02", label: "today", slots: [slot("2026-11-02", "09:00", false)] }], "2026-11-02", "any")).toBeNull();
  });
});
