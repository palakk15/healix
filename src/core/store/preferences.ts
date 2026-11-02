import { createStore, type StoreApi } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { defaultLanguage, isLanguageCode, type LanguageCode } from "../i18n/languages";

export interface PreferencesState {
  language: LanguageCode;
  elderMode: boolean;
  fastDemo: boolean;
  setLanguage: (language: LanguageCode) => void;
  setElderMode: (enabled: boolean) => void;
  setFastDemo: (enabled: boolean) => void;
}

export type StorageProvider = () => StateStorage | undefined;

export const preferencesStorageKey = "healix.preferences";

function guardedStorage(provider: StorageProvider): StateStorage {
  return {
    getItem: (name) => {
      try {
        return provider()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        provider()?.setItem(name, value);
      } catch {
        return;
      }
    },
    removeItem: (name) => {
      try {
        provider()?.removeItem(name);
      } catch {
        return;
      }
    },
  };
}

export function createPreferencesStore(provider: StorageProvider): StoreApi<PreferencesState> {
  return createStore<PreferencesState>()(
    persist(
      (set) => ({
        language: defaultLanguage,
        elderMode: false,
        fastDemo: false,
        setLanguage: (language) => set({ language }),
        setElderMode: (elderMode) => set({ elderMode }),
        setFastDemo: (fastDemo) => set({ fastDemo }),
      }),
      {
        name: preferencesStorageKey,
        storage: createJSONStorage(() => guardedStorage(provider)),
        partialize: (state) => ({ language: state.language, elderMode: state.elderMode }),
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as Partial<Pick<PreferencesState, "language" | "elderMode">>;
          return {
            ...current,
            language: isLanguageCode(saved.language) ? saved.language : current.language,
            elderMode: typeof saved.elderMode === "boolean" ? saved.elderMode : current.elderMode,
          };
        },
      },
    ),
  );
}
