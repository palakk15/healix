import { describe, expect, it } from "vitest";
import { contrastRatio } from "./domain/contrast";
import { colors, spacing, typeScale } from "./tokens";

describe("design tokens", () => {
  it("keeps the exact spec colours", () => {
    expect(colors.bg).toBe("#F4F2EC");
    expect(colors.accent).toBe("#3F6F63");
    expect(colors.ink).toBe("#16181D");
  });

  it("only uses the allowed spacing scale", () => {
    expect([...spacing]).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
  });

  it("defines the display-xl style exactly", () => {
    expect(typeScale["display-xl"]).toMatchObject({ size: 112, line: 104, tracking: -0.035, mobileSize: 56 });
  });

  it.each(["bg", "surface", "stage"] as const)("ink3Text passes AA on %s", (background) => {
    expect(contrastRatio(colors.ink3Text, colors[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["ink2", "bg"],
    ["ink", "bg"],
    ["accent", "bg"],
    ["accentSoftText", "accentSoft"],
    ["watchText", "watchTint"],
    ["alertText", "surface"],
    ["darkBody", "ink"],
  ] as const)("%s passes AA on %s", (foreground, background) => {
    expect(contrastRatio(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
  });
});
