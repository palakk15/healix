import { createI18n, ensureLanguageLoaded, languages, loadMessageGroups, type MessageGroup } from "@core/i18n";
import { preferencesStore } from "./store";

export const i18n = createI18n();

async function applyPreferences(): Promise<void> {
  const { language, elderMode } = preferencesStore.getState();
  const root = document.documentElement;
  root.dataset.elder = String(elderMode);
  await ensureLanguageLoaded(i18n, language);
  if (preferencesStore.getState().language !== language) return;
  if (i18n.language !== language) await i18n.changeLanguage(language);
  root.lang = languages[language].htmlLang;
}

export function prepareI18n(): Promise<void> {
  return applyPreferences();
}

export function watchPreferences(): () => void {
  return preferencesStore.subscribe(() => {
    void applyPreferences();
  });
}

export function loadGroups(groups: readonly MessageGroup[]): Promise<void> {
  return loadMessageGroups(i18n, preferencesStore.getState().language, groups);
}
