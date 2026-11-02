import { describe, expect, it } from "vitest";
import { languageNativeName, speaksPatientLanguage, languageOptions, patientLanguageName, sortLanguagesForPatient } from "./doctorLanguages";
import { delayAlertThresholdMinutes, waitChange } from "./delayAlert";
import { maxSwapRequests, requestsLeft, swapBlockReason } from "./swapRules";
import { formatCountdown, minutesUntil, secondsUntil, serverNowMs, serverOffsetMs } from "./tokenClock";

describe("server clock", () => {
  it("measures how far the server clock is from this device and uses it for countdowns", () => {
    const offset = serverOffsetMs("2026-11-02T04:40:00.000Z", Date.parse("2026-11-02T04:39:50.000Z"));
    expect(offset).toBe(10_000);
    expect(serverNowMs(offset, Date.parse("2026-11-02T04:41:00.000Z"))).toBe(Date.parse("2026-11-02T04:41:10.000Z"));
  });

  it("counts minutes down to the leave time, rounding up, and never goes below zero", () => {
    const leaveBy = "2026-11-02T05:05:00.000Z";
    const now = Date.parse("2026-11-02T04:40:00.000Z");
    expect(minutesUntil(leaveBy, 0, now)).toBe(25);
    expect(minutesUntil(leaveBy, 0, now + 30_000)).toBe(25);
    expect(minutesUntil(leaveBy, 0, now + 60_000)).toBe(24);
    expect(minutesUntil(leaveBy, 0, Date.parse("2026-11-02T05:05:00.000Z"))).toBe(0);
    expect(minutesUntil(leaveBy, 0, Date.parse("2026-11-02T06:00:00.000Z"))).toBe(0);
    expect(minutesUntil(leaveBy, -60_000, now)).toBe(26);
  });

  it("counts seconds and formats a swap countdown as minutes and seconds", () => {
    const expires = "2026-11-02T04:45:00.000Z";
    const now = Date.parse("2026-11-02T04:40:00.000Z");
    expect(secondsUntil(expires, 0, now)).toBe(300);
    expect(formatCountdown(300)).toBe("5:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(0)).toBe("0:00");
    expect(secondsUntil(expires, 0, now + 400_000)).toBe(0);
  });
});

describe("delay alert", () => {
  it("only alerts when the wait moves by more than 15 minutes, in either direction", () => {
    expect(delayAlertThresholdMinutes).toBe(15);
    expect(waitChange(53, 68)).toEqual({ alert: false, deltaMinutes: 15 });
    expect(waitChange(53, 69)).toEqual({ alert: true, deltaMinutes: 16 });
    expect(waitChange(53, 37)).toEqual({ alert: true, deltaMinutes: -16 });
    expect(waitChange(53, 40)).toEqual({ alert: false, deltaMinutes: -13 });
  });
});

describe("swap rules", () => {
  const open = { tokenStatus: "waiting" as const, requestsUsed: 0, hasPending: false, candidatesAhead: 4 };

  it("allows a swap when waiting with room, nothing pending and people ahead", () => {
    expect(swapBlockReason(open)).toBeNull();
  });

  it("explains why not, in priority order", () => {
    expect(swapBlockReason({ ...open, tokenStatus: "called", requestsUsed: 3 })).toBe("called");
    expect(swapBlockReason({ ...open, requestsUsed: maxSwapRequests, hasPending: true })).toBe("limit");
    expect(swapBlockReason({ ...open, hasPending: true, candidatesAhead: 0 })).toBe("pending");
    expect(swapBlockReason({ ...open, candidatesAhead: 0 })).toBe("nobody_ahead");
  });

  it("counts the requests that are left", () => {
    expect(maxSwapRequests).toBe(3);
    expect([0, 1, 2, 3, 5].map(requestsLeft)).toEqual([3, 2, 1, 0, 0]);
  });
});

describe("doctor languages", () => {
  it("maps the page language to the language a doctor speaks, treating Hinglish as Hindi", () => {
    expect(patientLanguageName("mr")).toBe("Marathi");
    expect(patientLanguageName("hinglish")).toBe("Hindi");
    expect(speaksPatientLanguage(["Hindi", "English"], "hinglish")).toBe(true);
    expect(speaksPatientLanguage(["Hindi", "English"], "mr")).toBe(false);
  });

  it("shows each language in its own script, and leaves unknown ones as they are", () => {
    expect(["Marathi", "Hindi", "English", "Gujarati", "Kannada", "Telugu", "Urdu"].map(languageNativeName)).toEqual(["मराठी", "हिन्दी", "English", "ગુજરાતી", "ಕನ್ನಡ", "తెలుగు", "اردو"]);
    expect(languageNativeName("Tulu")).toBe("Tulu");
  });

  it("puts the patient's language first and lists every language once", () => {
    expect(sortLanguagesForPatient(["Hindi", "English", "Marathi"], "mr")).toEqual(["Marathi", "Hindi", "English"]);
    expect(languageOptions([["Hindi", "English"], ["English", "Urdu"]])).toEqual(["English", "Hindi", "Urdu"]);
  });
});
