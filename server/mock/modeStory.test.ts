import { describe, expect, it } from "vitest";
import { dashboardBookingModes } from "./dashboard";
import { modeStory } from "./modeStory";
import { MockWorld } from "./world";

describe("booking mode descriptions", () => {
  const world = new MockWorld();

  it("gives every doctor in every hospital a different description", () => {
    for (const hospital of world.hospitals.keys()) {
      const reasons = dashboardBookingModes(world, hospital).modes.map((entry) => entry.reason);
      expect(reasons.every((reason) => reason.length > 40)).toBe(true);
      expect(new Set(reasons).size).toBe(reasons.length);
    }
  });

  it("mentions facts that belong to the doctor, not a shared sentence", () => {
    const meera = world.doctors.get("doc_meera");
    if (!meera) throw new Error("missing doctor");
    const story = modeStory({ doctor: meera, mode: "pessimistic", status: "running", waiting: 7, predictedWait: 41, delayMinutes: 8, quickFollowUps: false, bufferMinutes: 10, now: new Date() });
    expect(story).toContain("7");
    expect(story).toContain("41");
    expect(story).toContain("10");
    expect(story).toContain("8 min behind");
  });

  it("changes when the mode changes", () => {
    const arjun = world.doctors.get("doc_arjun");
    if (!arjun) throw new Error("missing doctor");
    const base = { doctor: arjun, status: "running" as const, waiting: 3, predictedWait: 20, delayMinutes: 0, quickFollowUps: false, bufferMinutes: 10, now: new Date() };
    expect(modeStory({ ...base, mode: "optimistic" })).not.toBe(modeStory({ ...base, mode: "pessimistic" }));
  });

  it("explains leave and closed doctors in their own words", () => {
    const [doctor] = [...world.doctors.values()];
    if (!doctor) throw new Error("missing doctor");
    const base = { doctor, mode: "optimistic" as const, waiting: 0, predictedWait: 0, delayMinutes: 0, quickFollowUps: false, bufferMinutes: 10, now: new Date() };
    expect(modeStory({ ...base, status: "on_leave" })).toContain("on leave today");
    expect(modeStory({ ...base, status: "closed" })).toContain("not in clinic");
  });
});
