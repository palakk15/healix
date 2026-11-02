import type { Observation } from "@core/api/schemas/ai";
import type { LanguageCode } from "@core/i18n/languages";
import {
  glossaryAnalytes,
  glossaryTerms,
  greetingPattern,
  helpPattern,
  byePattern,
  thanksPattern,
  smallTalk,
  mine,
  noReportMessage,
  offTopicMessage,
  reportContext,
  summaryIntent,
  unknownTermMessage,
  type GlossaryAnalyte,
  type GlossaryTerm,
} from "./glossary";
import { genericMeaning } from "./genericExplain";
import { detectLanguage } from "./triage";

type Localized = Record<LanguageCode, string>;

export type AssistantIntent =
  | { kind: "analytes"; analytes: GlossaryAnalyte[] }
  | { kind: "terms"; terms: GlossaryTerm[] }
  | { kind: "small_talk"; talk: "greeting" | "thanks" | "bye" | "help" }
  | { kind: "summary" }
  | { kind: "unknown_term" }
  | { kind: "off_topic" };

export type AssistantObservation = Pick<Observation, "code" | "display" | "value" | "unit" | "reference" | "interpretation">;

export const disclaimers: Localized = {
  en: "This explains the words in your report. It is guidance, not a diagnosis. Your doctor decides.",
  hi: "यह आपकी रिपोर्ट के शब्द समझाता है। यह मार्गदर्शन है, निदान नहीं। फ़ैसला आपके डॉक्टर का है।",
  mr: "हे तुमच्या अहवालातील शब्द समजावते. हे मार्गदर्शन आहे, निदान नाही. निर्णय तुमच्या डॉक्टरांचा आहे.",
  hinglish: "Yeh aapki report ke shabd samjhata hai. Yeh guidance hai, diagnosis nahi. Faisla aapke doctor ka hai.",
};

export function classify(message: string): AssistantIntent {
  const text = message.trim();
  if (text.length === 0) return { kind: "off_topic" };
  if (greetingPattern.test(text)) return { kind: "small_talk", talk: "greeting" };
  if (thanksPattern.test(text)) return { kind: "small_talk", talk: "thanks" };
  if (byePattern.test(text)) return { kind: "small_talk", talk: "bye" };
  if (helpPattern.test(text)) return { kind: "small_talk", talk: "help" };

  let analytes = glossaryAnalytes.filter((entry) => entry.pattern.test(text));
  if (analytes.some((entry) => entry.code === "HDL" || entry.code === "LDL") && !/total|कुल|एकूण/i.test(text)) {
    analytes = analytes.filter((entry) => entry.code !== "TC");
  }
  if (analytes.length > 0) return { kind: "analytes", analytes: analytes.slice(0, 2) };

  const context = reportContext.test(text);
  const terms = glossaryTerms.filter((entry) => (entry.strong?.test(text) ?? false) || (entry.pattern.test(text) && (!entry.needsContext || context)));
  if (terms.length > 0) return { kind: "terms", terms: terms.slice(0, 2) };

  if (summaryIntent.test(text)) return { kind: "summary" };
  if (context) return { kind: "unknown_term" };
  return { kind: "off_topic" };
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

function rangeText(reference: { low: number | null; high: number | null }, unit: string): string {
  const { low, high } = reference;
  if (low !== null && low > 0 && high !== null) return `${low} to ${high} ${unit}`;
  if (high !== null) return `up to ${high} ${unit}`;
  if (low !== null) return `from ${low} ${unit}`;
  return unit;
}

function whereOf(observation: AssistantObservation, language: LanguageCode): string {
  if (observation.interpretation === "normal") return mine.within[language];
  return observation.interpretation === "low" ? mine.below[language] : mine.above[language];
}

function personal(observation: AssistantObservation | undefined, language: LanguageCode): string {
  if (!observation) return "";
  return fill(mine.line[language], {
    name: observation.display,
    value: observation.value,
    unit: observation.unit,
    where: whereOf(observation, language),
    range: rangeText(observation.reference, observation.unit),
  });
}

function summary(observations: readonly AssistantObservation[], language: LanguageCode): string {
  if (observations.length === 0) return noReportMessage[language];
  const flagged = observations.filter((entry) => entry.interpretation !== "normal");
  if (flagged.length === 0) return fill(mine.summaryAllOk[language], { total: observations.length });
  const lines = flagged.map((entry) => fill(mine.summaryFlag[language], { name: entry.display, value: entry.value, unit: entry.unit, where: whereOf(entry, language) }));
  return [fill(mine.summaryHead[language], { flagged: flagged.length, total: observations.length }), ...lines, flagged.length < observations.length ? mine.summaryOk[language] : ""].filter(Boolean).join(" ");
}

export type AssistantAnswer = { type: "answer"; text: string } | { type: "refusal"; message: string; reason: "off_topic" | "unknown_term" };

export function answerFor(message: string, language: LanguageCode, observations: readonly AssistantObservation[]): AssistantAnswer {
  const intent = classify(message);
  switch (intent.kind) {
    case "off_topic":
      return { type: "refusal", message: offTopicMessage[language], reason: "off_topic" };
    case "unknown_term":
      return { type: "refusal", message: unknownTermMessage[language], reason: "unknown_term" };
    case "small_talk":
      return { type: "answer", text: smallTalk[intent.talk][language] };
    case "summary":
      return { type: "answer", text: summary(observations, language) };
    case "terms":
      return { type: "answer", text: intent.terms.map((entry) => entry.text[language]).join(" ") };
    case "analytes": {
      const parts = intent.analytes.map((entry) => {
        const observation = observations.find((candidate) => candidate.code === entry.code);
        const extra =
          observation && observation.interpretation !== "normal"
            ? genericMeaning(entry.display, observation.interpretation === "low" ? "low" : "high", language)
            : "";
        return [entry.what[language], personal(observation, language), extra].filter(Boolean).join(" ");
      });
      return { type: "answer", text: parts.join(" ") };
    }
  }
}

export interface AssistantSseMessage {
  event: "token" | "refusal" | "citations" | "done";
  data: unknown;
}

export interface AssistantStreamOptions {
  wordDelayMs: number;
  requestId: string;
  sleep: (ms: number) => Promise<void>;
}

const modelName = "report-glossary";
const promptVersion = "v1";

export async function* streamAssistant(
  message: string,
  requestedLanguage: string | undefined,
  options: AssistantStreamOptions,
  observations: readonly AssistantObservation[] = [],
): AsyncGenerator<AssistantSseMessage> {
  const language = (requestedLanguage && requestedLanguage in disclaimers ? requestedLanguage : detectLanguage(message)) as LanguageCode;
  const envelope = { language, request_id: options.requestId, model: modelName, prompt_version: promptVersion, disclaimer: disclaimers[language] };
  const answer = answerFor(message, language, observations);

  if (answer.type === "refusal") {
    yield { event: "refusal", data: { message: answer.message, reason: answer.reason } };
    yield { event: "done", data: envelope };
    return;
  }

  for (const word of answer.text.split(/(?<=\s)/)) {
    yield { event: "token", data: { text: word } };
    if (options.wordDelayMs > 0) await options.sleep(options.wordDelayMs);
  }
  yield { event: "done", data: envelope };
}
