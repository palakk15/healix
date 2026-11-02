import { describe, expect, it } from "vitest";
import { advanceDemoQueue, initialDemoQueue } from "./demoQueue";
import { sampleToken, sampleTokenId } from "./sampleToken";

describe("sample token", () => {
  const now = Date.UTC(2026, 10, 1, 4, 40);

  it("is a complete, waiting token built from the demo queue", () => {
    const token = sampleToken(initialDemoQueue, now);
    expect(token.id).toBe(sampleTokenId);
    expect(token.status).toBe("waiting");
    expect(token.ahead).toBe(initialDemoQueue.doctors[0]?.waiting);
    expect(token.predicted_wait.range_low).toBeLessThanOrEqual(token.predicted_wait.wait_minutes);
    expect(token.predicted_wait.range_high).toBeGreaterThanOrEqual(token.predicted_wait.wait_minutes);
    expect(token.predicted_wait.reasons.reduce((sum, reason) => sum + reason.minutes, 0)).toBe(14);
  });

  it("moves when the demo queue moves", () => {
    const later = sampleToken(advanceDemoQueue(initialDemoQueue), now);
    expect(later.now_serving).not.toBe(sampleToken(initialDemoQueue, now).now_serving);
  });
});
