import { describe, expect, it } from "vitest";
import { languageCodes } from "../i18n/languages";
import { adviseLeaveTime } from "./leaveTime";
import { distanceKm } from "./geo";
import { specialtyLabels, urgencyLabels } from "./labels";
import { specialties, urgencies } from "./specialty";

describe("labels", () => {
  it("covers every specialty in every language", () => {
    for (const specialty of specialties) {
      for (const language of languageCodes) {
        const label = specialtyLabels[specialty][language];
        expect(label.title.trim().length, `${specialty}/${language} title`).toBeGreaterThan(0);
        expect(label.plain.trim().length, `${specialty}/${language} plain`).toBeGreaterThan(0);
      }
    }
  });

  it("covers every urgency in every language", () => {
    for (const urgency of urgencies) {
      for (const language of languageCodes) {
        expect(urgencyLabels[urgency][language].trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("geo and leave advice", () => {
  it("computes realistic distances", () => {
    const kothrud = { lat: 18.5, lng: 73.8077 };
    const clinic = { lat: 18.5189, lng: 73.8077 };
    expect(distanceKm(kothrud, clinic)).toBeCloseTo(2.1, 1);
  });

  it("follows suggested_arrival = now + wait - 10 and subtracts travel", () => {
    const advice = adviseLeaveTime("2026-11-02T04:40:00.000Z", 53, 18);
    expect(advice.leaveInMinutes).toBe(25);
    expect(advice.leaveByIso).toBe("2026-11-02T05:05:00.000Z");
    expect(advice.arriveByIso).toBe("2026-11-02T05:23:00.000Z");
  });

  it("never returns a negative leave time", () => {
    expect(adviseLeaveTime("2026-11-02T04:40:00.000Z", 5, 30).leaveInMinutes).toBe(0);
  });
});
