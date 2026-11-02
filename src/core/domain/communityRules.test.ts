import { describe, expect, it } from "vitest";
import { aliasFor, findContentProblem, timeAgoParts } from "./communityRules";

describe("community rules", () => {
  it("blocks phone numbers, emails, links and doses, and allows ordinary talk", () => {
    expect(findContentProblem("call me on 9876543210")).toBe("phone");
    expect(findContentProblem("write to asha@example.com")).toBe("email");
    expect(findContentProblem("see https://example.org/page")).toBe("link");
    expect(findContentProblem("I take 500 mg every morning")).toBe("dose");
    expect(findContentProblem("two tablets after food")).toBe("dose");
    expect(findContentProblem("My sugar was 132 this morning and I walk daily")).toBeNull();
  });

  it("gives the same nickname to the same person and different ones to others", () => {
    expect(aliasFor("pat_a")).toBe(aliasFor("pat_a"));
    expect(aliasFor("pat_a")).not.toBe(aliasFor("pat_b"));
    expect(aliasFor("pat_a")).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it("describes how long ago something was posted", () => {
    const now = Date.UTC(2026, 10, 1, 12, 0);
    expect(timeAgoParts(now - 20_000, now)).toEqual({ unit: "now", value: 0 });
    expect(timeAgoParts(now - 5 * 60_000, now)).toEqual({ unit: "minutes", value: 5 });
    expect(timeAgoParts(now - 3 * 3_600_000, now)).toEqual({ unit: "hours", value: 3 });
    expect(timeAgoParts(now - 2 * 86_400_000, now)).toEqual({ unit: "days", value: 2 });
  });
});
