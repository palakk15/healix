import type { SlotsResponse } from "../api/schemas/backend";
import { istParts } from "./time";

export const timeWindows = ["any", "morning", "afternoon", "evening"] as const;
export type TimeWindow = (typeof timeWindows)[number];

export const visitPurposes = ["new", "followUp", "report", "checkup", "secondOpinion"] as const;
export type VisitPurpose = (typeof visitPurposes)[number];

const ranges: Record<Exclude<TimeWindow, "any">, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 16],
  evening: [16, 22],
};

export function isTimeWindow(value: string | null | undefined): value is TimeWindow {
  return timeWindows.some((entry) => entry === value);
}

export function isVisitPurpose(value: string | null | undefined): value is VisitPurpose {
  return visitPurposes.some((entry) => entry === value);
}

export function inWindow(startIso: string, window: TimeWindow): boolean {
  if (window === "any") return true;
  const hour = istParts(new Date(startIso)).hour;
  const [from, to] = ranges[window];
  return hour >= from && hour < to;
}

export interface PickedSlot {
  start: string;
  date: string;
  label: SlotsResponse["days"][number]["label"];
  exactDate: boolean;
  exactWindow: boolean;
}

export function pickSlot(days: SlotsResponse["days"], dateKey: string, window: TimeWindow): PickedSlot | null {
  const ordered = [...days.filter((day) => day.date === dateKey), ...days.filter((day) => day.date > dateKey), ...days.filter((day) => day.date < dateKey)];
  for (const day of ordered) {
    const free = day.slots.filter((slot) => slot.available);
    if (free.length === 0) continue;
    const exact = free.find((slot) => inWindow(slot.start, window));
    if (exact) return { start: exact.start, date: day.date, label: day.label, exactDate: day.date === dateKey, exactWindow: true };
    if (day.date === dateKey) {
      const first = free[0];
      if (first) return { start: first.start, date: day.date, label: day.label, exactDate: true, exactWindow: false };
    }
  }
  for (const day of ordered) {
    const first = day.slots.find((slot) => slot.available);
    if (first) return { start: first.start, date: day.date, label: day.label, exactDate: day.date === dateKey, exactWindow: window === "any" };
  }
  return null;
}
