import type { Citation } from "@core/api/schemas/ai";
import type { LanguageCode } from "@core/i18n/languages";
import { answerFor, classify, disclaimers, type AssistantObservation, type AssistantSseMessage } from "../mock/assistant";
import { noReportMessage, offTopicMessage } from "../mock/glossary";
import { detectLanguage } from "../mock/triage";
import { completeGroq, type GroqConfig, type GroqMessage, type GroqTransport } from "./groq";
import { tokenize } from "./embedder";
import type { ReportDocument, SearchHit, VectorStore } from "./store";

export interface RagOptions {
  requestId: string;
  wordDelayMs: number;
  sleep: (ms: number) => Promise<void>;
  groq?: GroqConfig;
  transport?: GroqTransport;
  onGroqProblem?: (reason: string) => void;
}

export interface RagInput {
  message: string;
  language?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  documents: readonly ReportDocument[];
  profileIds: readonly string[];
  observations: readonly AssistantObservation[];
}

export const relevanceThreshold = 0.16;
const retrievalLimit = 4;
const modelLabel = "report-rag";

const languageNames: Record<LanguageCode, string> = {
  en: "English",
  hi: "Hindi (Devanagari script)",
  mr: "Marathi (Devanagari script)",
  hinglish: "Hinglish (Hindi written in Latin letters)",
};

const offTopicToken = "OFF_TOPIC";

const unsafeAnswer = [
  /\byou (?:have|may have|might have|probably have)\s+(?!(?:any|a|an|the|questions?|to|been|not|no|more|time|about)\b)/i,
  /\bdiagnosis\s*:/i,
  /\byou are suffering\b/i,
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|iu)\b(?!\s?\/)/i,
  /\btake\s+\d/i,
  /\b(?:tablet|capsule|syrup|injection)s?\b/i,
];

const medicineQuestion = /\b(tablets?|capsules?|doses?|dosage|medicines?|medications?|drugs?|prescri\w*|syrup|injection)\b|कितनी गोली|गोली|दवा|दवाई|गोळी|औषध|goli|dawa|dawai/i;

function sharesWord(query: string, text: string): boolean {
  const words = new Set(tokenize(text));
  return tokenize(query).some((token) => token.length > 2 && words.has(token));
}

export function isSafeAnswer(text: string): boolean {
  return !unsafeAnswer.some((pattern) => pattern.test(text));
}

function systemPrompt(language: LanguageCode, hasReport: boolean): string {
  return [
    "You are Healix AI, a warm, calm assistant inside a patient app. You help people understand their uploaded medical reports and everyday health words in simple language.",
    "You may greet people, thank them, chat briefly, explain what you can do and how to use Healix, and answer general health-education questions such as what a lab test, body part, symptom word or healthy habit means.",
    hasReport
      ? "For questions about the patient's own results, use the numbered report excerpts provided. If the excerpts do not contain the answer, say you cannot find it in the report and suggest asking the doctor."
      : "The patient has not uploaded a confirmed report yet. Answer in general words and, when relevant, invite them to upload a report under Reports for a personal answer.",
    `If the message is clearly unrelated to health, medical reports or using Healix (for example sports, politics, coding, shopping), reply with exactly ${offTopicToken} and nothing else.`,
    "Never diagnose, never say the patient has a disease, never suggest or mention specific medicines or doses, never tell the patient to start or stop treatment. For anything urgent or worrying, tell them to see a doctor.",
    "Explain values in simple words, say whether a value is inside or outside the printed reference range, and when it is sensible to talk to a doctor.",
    "Keep the answer under 120 words, friendly and plain.",
    hasReport ? "When you use the report excerpts, cite them with markers like [1] or [2] right after the sentence." : "",
    `Write the answer in ${languageNames[language]}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function contextBlock(hits: readonly SearchHit[]): string {
  return hits.map((hit, index) => `[${index + 1}] (${hit.chunk.title})\n${hit.chunk.text}`).join("\n\n");
}

export function citationsFrom(hits: readonly SearchHit[]): Citation[] {
  return hits.map((hit, index) => ({
    n: index + 1,
    title: hit.chunk.title,
    section: `Report excerpt ${hit.chunk.index + 1}`,
    page: 1,
    url: `/app/reports/${hit.chunk.reportId}`,
    year: new Date(hit.chunk.issuedAtMs).getUTCFullYear(),
    excerpt: hit.chunk.text.slice(0, 400),
  }));
}

function envelope(language: LanguageCode, options: RagOptions, model: string) {
  return { language, request_id: options.requestId, model, prompt_version: "rag-v1", disclaimer: disclaimers[language] };
}

async function* words(text: string, options: RagOptions): AsyncGenerator<AssistantSseMessage> {
  for (const word of text.split(/(?<=\s)/)) {
    yield { event: "token", data: { text: word } };
    if (options.wordDelayMs > 0) await options.sleep(options.wordDelayMs);
  }
}

function fromReport(hits: readonly SearchHit[], language: LanguageCode, question: string): string {
  if (hits.length === 0) return noReportMessage[language];
  const asked = new Set(tokenize(question));
  const candidates = hits
    .flatMap((hit, hitIndex) => hit.chunk.text.split("\n").map((line, lineIndex) => ({ line, position: hitIndex * 1000 + lineIndex })))
    .map(({ line, position }) => ({ line: line.trim(), position, hits: tokenize(line).filter((token) => asked.has(token)).length + (/:\s*\d/.test(line) ? 2 : 0) }))
    .filter((entry) => entry.line.length > 0 && !entry.line.endsWith(":"));
  const chosen = candidates
    .sort((a, b) => b.hits - a.hits || a.position - b.position)
    .slice(0, 2)
    .sort((a, b) => a.position - b.position);
  const lines = chosen.map((entry) => entry.line).join(" ");
  const intro: Record<LanguageCode, string> = {
    en: "This is the closest part of your report:",
    hi: "आपकी रिपोर्ट का सबसे करीबी हिस्सा यह है:",
    mr: "तुमच्या अहवालातील सर्वात जवळचा भाग हा आहे:",
    hinglish: "Aapki report ka sabse paas wala hissa yeh hai:",
  };
  return `${intro[language]} ${lines} [1]`;
}

async function askGroq(options: RagOptions, messages: GroqMessage[]): Promise<string | null> {
  if (!options.groq) return null;
  const strict: GroqMessage = { role: "system", content: "Reminder: do not say the patient has any condition and do not mention medicines, tablets or doses. Describe only what the report values show." };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = await completeGroq(options.groq, attempt === 0 ? messages : [...messages, strict], options.transport);
      if (text.length === 0) {
        options.onGroqProblem?.("Groq returned an empty answer");
        return null;
      }
      if (text.startsWith(offTopicToken)) return offTopicToken;
      if (isSafeAnswer(text)) return text;
      options.onGroqProblem?.("Groq answer was held back by the safety check");
    } catch (error) {
      options.onGroqProblem?.(error instanceof Error ? error.message : "Groq request failed");
      return null;
    }
  }
  return null;
}

export async function* ragAnswer(store: VectorStore, input: RagInput, options: RagOptions): AsyncGenerator<AssistantSseMessage> {
  const language = (input.language && input.language in disclaimers ? input.language : detectLanguage(input.message)) as LanguageCode;
  store.sync(input.documents);
  const hasReport = store.countFor(input.profileIds) > 0;
  const askingForMedicine = medicineQuestion.test(input.message);
  const history = (input.history ?? []).slice(-6).map((entry): GroqMessage => ({ role: entry.role, content: entry.content }));

  const refuse = function* (reason: "off_topic" | "unknown_term" | "no_report", message: string, model: string): Generator<AssistantSseMessage> {
    yield { event: "refusal", data: { message, reason } };
    yield { event: "done", data: envelope(language, options, model) };
  };

  if (classify(input.message).kind === "small_talk") {
    const talk = answerFor(input.message, language, input.observations);
    if (talk.type === "answer") {
      yield* words(talk.text, options);
      yield { event: "done", data: envelope(language, options, "report-glossary") };
      return;
    }
  }

  if (askingForMedicine) {
    yield* refuse("off_topic", offTopicMessage[language], modelLabel);
    return;
  }

  const hits = hasReport ? store.search(input.message, { profileIds: input.profileIds, limit: retrievalLimit }) : [];
  const relevant = hits.filter((hit) => hit.score >= relevanceThreshold && sharesWord(input.message, hit.chunk.text));
  const used = relevant.length > 0 ? relevant : hits.slice(0, 3);

  if (options.groq) {
    const user = hasReport ? `Report excerpts:\n${contextBlock(used)}\n\nPatient question: ${input.message}` : input.message;
    const text = await askGroq(options, [{ role: "system", content: systemPrompt(language, hasReport) }, ...history, { role: "user", content: user }]);
    if (text === offTopicToken) {
      yield* refuse("off_topic", offTopicMessage[language], options.groq.model);
      return;
    }
    if (text) {
      if (hasReport) yield { event: "citations", data: citationsFrom(used) };
      yield* words(text, options);
      yield { event: "done", data: envelope(language, options, options.groq.model) };
      return;
    }
  }

  const deterministic = answerFor(input.message, language, input.observations);
  if (deterministic.type === "answer") {
    yield* words(deterministic.text, options);
    yield { event: "done", data: envelope(language, options, "report-glossary") };
    return;
  }
  if (relevant.length > 0) {
    yield { event: "citations", data: citationsFrom(hits) };
    yield* words(fromReport(hits, language, input.message), options);
    yield { event: "done", data: envelope(language, options, modelLabel) };
    return;
  }
  yield* refuse(deterministic.reason, deterministic.message, "report-glossary");
}
