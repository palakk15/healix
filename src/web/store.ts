import { useStore } from "zustand";
import { createPreferencesStore, type PreferencesState } from "@core/store/preferences";
import { createSessionStore, type SessionState } from "@core/store/session";
import { isLanguageCode } from "@core/i18n";

export const preferencesStore = createPreferencesStore(() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
});

export const sessionStore = createSessionStore(() => {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
});

export function usePreferences<Selected>(selector: (state: PreferencesState) => Selected): Selected {
  return useStore(preferencesStore, selector);
}

export function useSession<Selected>(selector: (state: SessionState) => Selected): Selected {
  return useStore(sessionStore, selector);
}

export function applyLanguageFromQuery(search: string): void {
  const requested = new URLSearchParams(search).get("lang");
  if (isLanguageCode(requested)) preferencesStore.getState().setLanguage(requested);
}

export function applyFastDemoFromQuery(search: string): void {
  if (new URLSearchParams(search).get("fast") === "1") preferencesStore.getState().setFastDemo(true);
}
