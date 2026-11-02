import { describe, expect, it } from "vitest";
import { bodyAreas, composeSymptomText, toggleArea } from "./bodyAreas";

const areaTemplate = (areas: string) => `Pain area: ${areas}.`;
const painTemplate = (level: number) => `Pain strength: ${level} out of 5.`;

describe("body areas", () => {
  it("has the 13 tappable regions", () => {
    expect(bodyAreas).toHaveLength(13);
    expect(new Set(bodyAreas).size).toBe(13);
  });

  it("adds an area on the first tap and removes it on the second", () => {
    expect(toggleArea([], "stomach")).toEqual(["stomach"]);
    expect(toggleArea(["stomach", "chest"], "stomach")).toEqual(["chest"]);
  });

  it("leaves typed text exactly as typed when nothing else was chosen", () => {
    expect(composeSymptomText({ text: "  Knee pain when climbing stairs for 2 weeks ", areaLabels: [], painLevel: null, areaTemplate, painTemplate })).toBe(
      "Knee pain when climbing stairs for 2 weeks",
    );
  });

  it("appends the chosen areas and pain strength, and works with no typed text", () => {
    expect(composeSymptomText({ text: "burning", areaLabels: ["Stomach", "Chest"], painLevel: 3, areaTemplate, painTemplate })).toBe(
      "burning Pain area: Stomach, Chest. Pain strength: 3 out of 5.",
    );
    expect(composeSymptomText({ text: "", areaLabels: ["Head"], painLevel: null, areaTemplate, painTemplate })).toBe("Pain area: Head.");
  });
});
