import type { ExplainResponse, Observation } from "../api/schemas/ai";

type ExplainItem = ExplainResponse["items"][number];

export const lowConfidenceBelow = 0.8;

export const isLowConfidence = (observation: Pick<Observation, "confidence">): boolean => observation.confidence < lowConfidenceBelow;

export function splitExplainItems(items: readonly ExplainItem[]): { flagged: ExplainItem[]; normal: ExplainItem[] } {
  const flagged = items.filter((item) => item.direction !== "normal").sort((a, b) => b.distance - a.distance);
  const normal = items.filter((item) => item.direction === "normal");
  return { flagged, normal };
}

export function parseValueInput(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export interface ValueDraft {
  [code: string]: string;
}

export function draftFrom(observations: readonly Observation[]): ValueDraft {
  return Object.fromEntries(observations.map((observation) => [observation.code, String(observation.value)]));
}

export function invalidCodes(draft: ValueDraft): string[] {
  return Object.entries(draft)
    .filter(([, text]) => parseValueInput(text) === null)
    .map(([code]) => code);
}

export function changedValues(observations: readonly Observation[], draft: ValueDraft): Array<{ code: string; value: number }> {
  return observations.flatMap((observation) => {
    const value = parseValueInput(draft[observation.code] ?? "");
    return value !== null && value !== observation.value ? [{ code: observation.code, value }] : [];
  });
}

export function allValues(observations: readonly Observation[], draft: ValueDraft): Array<{ code: string; value: number }> {
  return observations.flatMap((observation) => {
    const value = parseValueInput(draft[observation.code] ?? "");
    return value === null ? [] : [{ code: observation.code, value }];
  });
}

export function parchiText(title: string, questions: readonly string[]): string {
  return [title, "", ...questions.map((question, index) => `${index + 1}. ${question}`)].join("\n");
}

export const jobPollMs = 1000;
