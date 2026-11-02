import type { LanguageCode } from "../i18n/languages";
import { requestJson } from "./http";
import {
  lidResponseSchema,
  sttResponseSchema,
  translateResponseSchema,
  transliterateResponseSchema,
  ttsResponseSchema,
  type SpeechPurpose,
} from "./schemas/sarvam";

export interface TranscribeOptions {
  language: LanguageCode;
  purpose: SpeechPurpose;
  fileName?: string;
  signal?: AbortSignal;
}

export const sarvam = {
  transcribe(audio: Blob, options: TranscribeOptions) {
    const form = new FormData();
    form.set("audio", audio, options.fileName ?? "speech.wav");
    form.set("language", options.language);
    form.set("purpose", options.purpose);
    return requestJson("/sarvam/stt", { schema: sttResponseSchema, form, signal: options.signal });
  },

  speak(text: string, language: LanguageCode, pace?: number, signal?: AbortSignal) {
    return requestJson("/sarvam/tts", { schema: ttsResponseSchema, body: { text, language, ...(pace ? { pace } : {}) }, signal });
  },

  translate(text: string, target: LanguageCode, source?: LanguageCode) {
    return requestJson("/sarvam/translate", { schema: translateResponseSchema, body: { text, target, ...(source ? { source } : {}) } });
  },

  transliterate(text: string, from: LanguageCode, to: LanguageCode) {
    return requestJson("/sarvam/transliterate", { schema: transliterateResponseSchema, body: { text, from, to } });
  },

  identify(text: string) {
    return requestJson("/sarvam/lid", { schema: lidResponseSchema, body: { text } });
  },
};
