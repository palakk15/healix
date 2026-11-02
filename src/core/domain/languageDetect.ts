import type { LanguageCode } from "../i18n/languages";

export type Script = "devanagari" | "latin" | "other";

export function scriptOf(text: string): Script {
  const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (devanagari === 0 && latin === 0) return "other";
  return devanagari >= latin ? "devanagari" : "latin";
}

const marathiMarkers = /आहे|होते|होतो|पोटात|डोक्यात|गुडघ|आणि|मला|माझ|नाही|दुखत|जळजळ|दिवसांपासून|वाटते|का\s|काय\s|आहेत|मधुमेहात|महत्त्वाचे/;
const hindiRomanMarkers = /\b(mein|mai|hai|hain|ho|se|din|dard|bukhar|pet|jalan|raha|rahi|nahi|kya|mujhe|mera|meri|aur|bahut|tez|kaise|kab|kyun|lakshan)\b/;

export function detectLanguage(text: string): LanguageCode {
  if (/[ऀ-ॿ]/.test(text)) return marathiMarkers.test(text) ? "mr" : "hi";
  return hindiRomanMarkers.test(text.toLowerCase()) ? "hinglish" : "en";
}

const sarvamToLanguage: Record<string, LanguageCode> = {
  "en-in": "en",
  en: "en",
  "hi-in": "hi",
  hi: "hi",
  "mr-in": "mr",
  mr: "mr",
};

export function languageFromSarvamCode(code: string | null | undefined, transcript: string, current: LanguageCode): LanguageCode | null {
  if (!code) return null;
  const mapped = sarvamToLanguage[code.toLowerCase()];
  if (!mapped) return null;
  if (mapped === "hi" && scriptOf(transcript) === "latin") return "hinglish";
  if (mapped === "hi" && current === "hinglish" && scriptOf(transcript) === "latin") return "hinglish";
  return mapped;
}

export function languagesMatch(typed: LanguageCode, ui: LanguageCode): boolean {
  if (typed === ui) return true;
  return (typed === "hinglish" && ui === "hi") || (typed === "hi" && ui === "hinglish");
}
