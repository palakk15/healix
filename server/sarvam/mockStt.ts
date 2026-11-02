import type { LanguageCode } from "@core/i18n/languages";

export type SpeechPurpose = "symptoms" | "assistant" | "any";

const symptomPhrases: Record<LanguageCode, string[]> = {
  mr: ["जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून"],
  hinglish: ["Do din se pet mein jalan ho rahi hai"],
  hi: ["मुझे दो दिन से सिर में बहुत दर्द है", "बच्चे को तेज बुखार है, 2 महीने का है"],
  en: ["Knee pain when climbing stairs for 2 weeks", "chest pain and sweating"],
};

const assistantPhrases: Record<LanguageCode, string[]> = {
  mr: ["मधुमेहात व्हिटॅमिन डी का महत्त्वाचे आहे?"],
  hi: ["डेंगू के लक्षण क्या हैं?"],
  hinglish: ["Dengue ke lakshan kya hain?"],
  en: ["What is dengue and when should I go to hospital?", "How many metformin tablets should I take?"],
};

const detectedCode: Record<LanguageCode, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", hinglish: "hi-IN" };

export interface CannedTranscript {
  transcript: string;
  languageCode: string;
}

export function createCannedTranscriber() {
  const counters = new Map<string, number>();
  return (language: LanguageCode, purpose: SpeechPurpose): CannedTranscript => {
    const pool = purpose === "assistant" ? assistantPhrases[language] : symptomPhrases[language];
    const key = `${language}:${purpose}`;
    const index = counters.get(key) ?? 0;
    counters.set(key, index + 1);
    return { transcript: pool[index % pool.length] ?? "", languageCode: detectedCode[language] };
  };
}
