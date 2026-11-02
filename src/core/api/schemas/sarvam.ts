import { z } from "zod";
import { languageCodes } from "../../i18n/languages";

export const languageCodeSchema = z.enum(languageCodes);

export const speechPurposeSchema = z.enum(["symptoms", "assistant", "any"]);

export const sttResponseSchema = z.object({
  transcript: z.string(),
  language: languageCodeSchema.nullable(),
  source: z.enum(["sarvam", "mock"]),
});

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(8000),
  language: languageCodeSchema,
  pace: z.number().min(0.5).max(1.5).optional(),
});

export const ttsResponseSchema = z.object({
  audios: z.array(z.string().min(1)).min(1),
  language: languageCodeSchema,
  source: z.literal("sarvam"),
});

export const translateRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  target: languageCodeSchema,
  source: languageCodeSchema.optional(),
});

export const translateResponseSchema = z.object({
  text: z.string(),
  target: languageCodeSchema,
  cached: z.boolean(),
  source: z.enum(["sarvam", "passthrough"]),
  degraded: z.boolean(),
});

export const transliterateRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  from: languageCodeSchema,
  to: languageCodeSchema,
});

export const transliterateResponseSchema = z.object({ text: z.string() });

export const lidRequestSchema = z.object({ text: z.string().min(1).max(2000) });

export const lidResponseSchema = z.object({
  language: languageCodeSchema,
  source: z.enum(["sarvam", "local"]),
});

export type SpeechPurpose = z.infer<typeof speechPurposeSchema>;
export type SttResponse = z.infer<typeof sttResponseSchema>;
export type TtsResponse = z.infer<typeof ttsResponseSchema>;
export type TranslateResponse = z.infer<typeof translateResponseSchema>;
