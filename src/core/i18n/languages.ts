export const languageCodes = ["en", "hi", "mr", "hinglish"] as const;

export type LanguageCode = (typeof languageCodes)[number];

export type SpeechToTextMode = "transcribe" | "codemix";

export interface LanguageInfo {
  code: LanguageCode;
  nativeLabel: string;
  htmlLang: string;
  sarvamCode: "en-IN" | "hi-IN" | "mr-IN";
  speechMode: SpeechToTextMode;
  usesDevanagari: boolean;
}

export const languages: Record<LanguageCode, LanguageInfo> = {
  en: { code: "en", nativeLabel: "English", htmlLang: "en", sarvamCode: "en-IN", speechMode: "transcribe", usesDevanagari: false },
  hi: { code: "hi", nativeLabel: "हिन्दी", htmlLang: "hi", sarvamCode: "hi-IN", speechMode: "transcribe", usesDevanagari: true },
  mr: { code: "mr", nativeLabel: "मराठी", htmlLang: "mr", sarvamCode: "mr-IN", speechMode: "transcribe", usesDevanagari: true },
  hinglish: { code: "hinglish", nativeLabel: "Hinglish", htmlLang: "hi-Latn", sarvamCode: "hi-IN", speechMode: "codemix", usesDevanagari: false },
};

export const defaultLanguage: LanguageCode = "en";

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && (languageCodes as readonly string[]).includes(value);
}
