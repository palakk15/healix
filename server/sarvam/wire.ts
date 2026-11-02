import { z } from "zod";
import { languages, type LanguageCode } from "@core/i18n/languages";
import type { SarvamConfig } from "./config";

export const apiKeyHeader = "api-subscription-key";

export const wirePaths = {
  speechToText: "/speech-to-text",
  textToSpeech: "/text-to-speech",
  translate: "/translate",
  transliterate: "/transliterate",
  languageId: "/text-lid",
} as const;

export interface SttOptions {
  model: string;
  mode: "transcribe" | "codemix";
}

export function buildSttForm(audio: Blob, fileName: string, options: SttOptions): FormData {
  const form = new FormData();
  form.set("file", audio, fileName);
  form.set("model", options.model);
  form.set("mode", options.mode);
  form.set("language_code", "unknown");
  return form;
}

const sttResponseSchema = z.object({
  request_id: z.string().nullish(),
  transcript: z.string(),
  language_code: z.string().nullish(),
});

export function parseSttResponse(payload: unknown): { transcript: string; languageCode: string | null } | null {
  const parsed = sttResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  return { transcript: parsed.data.transcript.trim(), languageCode: parsed.data.language_code ?? null };
}

export function speakerFor(config: SarvamConfig, language: LanguageCode): string | undefined {
  if (language === "mr") return config.speakers.mr;
  if (language === "en") return config.speakers.en;
  return config.speakers.hi;
}

export function buildTtsBody(config: SarvamConfig, text: string, language: LanguageCode, pace: number): Record<string, unknown> {
  const code = languages[language].sarvamCode;
  const speaker = speakerFor(config, language);
  return {
    text,
    language_code: code,
    model: config.ttsModel,
    pace,
    ...(speaker ? { speaker } : {}),
  };
}

const ttsResponseSchema = z.object({
  request_id: z.string().nullish(),
  audios: z.array(z.string().min(1)).min(1),
});

export function parseTtsResponse(payload: unknown): { requestId: string | null; audios: string[] } | null {
  const parsed = ttsResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  return { requestId: parsed.data.request_id ?? null, audios: parsed.data.audios };
}

export function buildTranslateBody(config: SarvamConfig, text: string, source: LanguageCode | undefined, target: LanguageCode): Record<string, unknown> {
  return {
    input: text,
    source_language_code: source ? languages[source].sarvamCode : "auto",
    target_language_code: languages[target].sarvamCode,
    ...(config.translateModel ? { model: config.translateModel } : {}),
  };
}

const translateResponseSchema = z.object({ translated_text: z.string(), source_language_code: z.string().nullish() });

export function parseTranslateResponse(payload: unknown): { text: string; sourceLanguageCode: string | null } | null {
  const parsed = translateResponseSchema.safeParse(payload);
  if (!parsed.success) return null;
  return { text: parsed.data.translated_text, sourceLanguageCode: parsed.data.source_language_code ?? null };
}

export function buildTransliterateBody(text: string, from: LanguageCode, to: LanguageCode): Record<string, unknown> {
  return {
    input: text,
    source_language_code: from === "hinglish" || from === "en" ? "en-IN" : languages[from].sarvamCode,
    target_language_code: languages[to].sarvamCode,
  };
}

const transliterateResponseSchema = z.object({ transliterated_text: z.string() });

export function parseTransliterateResponse(payload: unknown): string | null {
  const parsed = transliterateResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data.transliterated_text : null;
}

export function buildLidBody(text: string): Record<string, unknown> {
  return { input: text };
}

const lidResponseSchema = z.object({ language_code: z.string().nullish() });

export function parseLidResponse(payload: unknown): string | null {
  const parsed = lidResponseSchema.safeParse(payload);
  return parsed.success ? (parsed.data.language_code ?? null) : null;
}
