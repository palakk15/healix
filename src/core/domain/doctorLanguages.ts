import type { LanguageCode } from "../i18n/languages";

const spokenLanguageName: Record<LanguageCode, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  hinglish: "Hindi",
};

export function patientLanguageName(language: LanguageCode): string {
  return spokenLanguageName[language];
}

export function speaksPatientLanguage(doctorLanguages: readonly string[], language: LanguageCode): boolean {
  return doctorLanguages.includes(patientLanguageName(language));
}

export function sortLanguagesForPatient(doctorLanguages: readonly string[], language: LanguageCode): string[] {
  const mine = patientLanguageName(language);
  return [...doctorLanguages].sort((a, b) => Number(b === mine) - Number(a === mine));
}

export function languageOptions(doctorLanguageLists: ReadonlyArray<readonly string[]>): string[] {
  return [...new Set(doctorLanguageLists.flat())].sort();
}

const nativeNames: Record<string, string> = {
  English: "English",
  Hindi: "हिन्दी",
  Marathi: "मराठी",
  Gujarati: "ગુજરાતી",
  Kannada: "ಕನ್ನಡ",
  Telugu: "తెలుగు",
  Urdu: "اردو",
};

export function languageNativeName(name: string): string {
  return nativeNames[name] ?? name;
}
