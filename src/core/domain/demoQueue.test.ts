import { describe, expect, it } from "vitest";
import { advanceDemoQueue, initialDemoQueue, isLongWait, leaveHomeMinutes, predictedWait, tokenLabel } from "./demoQueue";

describe("demo queue", () => {
  it("starts with the waits shown in the design", () => {
    const [gastro, cardio, general] = initialDemoQueue.doctors;
    expect(gastro && predictedWait(gastro)).toBe(32);
    expect(cardio && predictedWait(cardio)).toBe(14);
    expect(general && predictedWait(general)).toBe(48);
    expect(gastro && leaveHomeMinutes(gastro)).toBe(25);
    expect(general && isLongWait(general)).toBe(true);
    expect(gastro && isLongWait(gastro)).toBe(false);
  });

  it("formats token labels with zero padding", () => {
    const cardio = initialDemoQueue.doctors[1];
    expect(cardio && tokenLabel(cardio)).toBe("C-09");
  });

  it("calls the next patient for one doctor per tick and never empties a queue", () => {
    let state = initialDemoQueue;
    for (let index = 0; index < 60; index += 1) {
      const before = state;
      state = advanceDemoQueue(state);
      const changed = state.doctors.filter((doctor, position) => doctor.now !== before.doctors[position]?.now);
      expect(changed).toHaveLength(1);
      expect(state.doctors.every((doctor) => doctor.waiting >= 2)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(advanceDemoQueue(initialDemoQueue)).toEqual(advanceDemoQueue(initialDemoQueue));
  });
});
