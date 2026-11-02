import type { LanguageCode } from "../i18n/languages";

export interface FollowUp {
  question: string;
  options: string[];
}

type RawFollowUp = string | { question: string; options?: string[] };

const yesNoOptions: Record<LanguageCode, [string, string]> = {
  en: ["Yes", "No"],
  hi: ["हाँ", "नहीं"],
  mr: ["हो", "नाही"],
  hinglish: ["Haan", "Nahi"],
};

export function normalizeFollowUps(raw: readonly RawFollowUp[], language: LanguageCode): FollowUp[] {
  return raw.map((entry) => {
    if (typeof entry === "string") return { question: entry, options: [...yesNoOptions[language]] };
    const options = entry.options && entry.options.length > 0 ? entry.options : [...yesNoOptions[language]];
    return { question: entry.question, options };
  });
}

export type ReasoningStepKind = "input" | "safety" | "conclusion";

export function reasoningStepKinds(count: number): ReasoningStepKind[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return "input";
    if (index === count - 1 && count > 1) return "conclusion";
    return "safety";
  });
}

export const maxFollowUpRounds = 2;
