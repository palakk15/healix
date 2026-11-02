export const bodyAreas = [
  "head",
  "neck",
  "chest",
  "stomach",
  "upperBack",
  "lowerBack",
  "leftArm",
  "rightArm",
  "hips",
  "leftLeg",
  "rightLeg",
  "leftKnee",
  "rightKnee",
] as const;

export type BodyArea = (typeof bodyAreas)[number];

export type BodyView = "front" | "back";

export const painLevels = [1, 2, 3, 4, 5] as const;

export type PainLevel = (typeof painLevels)[number];

export function toggleArea(selected: readonly BodyArea[], area: BodyArea): BodyArea[] {
  return selected.includes(area) ? selected.filter((entry) => entry !== area) : [...selected, area];
}

export function composeSymptomText(parts: { text: string; areaLabels: string[]; painLevel: PainLevel | null; areaTemplate: (areas: string) => string; painTemplate: (level: number) => string }): string {
  const pieces: string[] = [];
  const typed = parts.text.trim();
  if (typed.length > 0) pieces.push(typed);
  if (parts.areaLabels.length > 0) pieces.push(parts.areaTemplate(parts.areaLabels.join(", ")));
  if (parts.painLevel !== null) pieces.push(parts.painTemplate(parts.painLevel));
  return pieces.join(" ");
}
