import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./messages/en/common.json";
import { defaultLanguage, type LanguageCode } from "./languages";

export const messageGroups = ["common", "landing", "app", "hospital", "styleguide"] as const;

export type MessageGroup = (typeof messageGroups)[number];

type Loader = () => Promise<{ default: unknown }>;

const empty: Loader = () => Promise.resolve({ default: {} });

const loaders: Record<LanguageCode, Record<MessageGroup, Loader>> = {
  en: {
    common: () => import("./messages/en/common.json"),
    landing: () => import("./messages/en/landing.json"),
    app: () => import("./messages/en/app.json"),
    hospital: () => import("./messages/en/hospital.json"),
    styleguide: () => import("./messages/en/styleguide.json"),
  },
  hi: {
    common: () => import("./messages/hi/common.json"),
    landing: () => import("./messages/hi/landing.json"),
    app: () => import("./messages/hi/app.json"),
    hospital: () => import("./messages/hi/hospital.json"),
    styleguide: empty,
  },
  mr: {
    common: () => import("./messages/mr/common.json"),
    landing: () => import("./messages/mr/landing.json"),
    app: () => import("./messages/mr/app.json"),
    hospital: () => import("./messages/mr/hospital.json"),
    styleguide: empty,
  },
  hinglish: {
    common: () => import("./messages/hinglish/common.json"),
    landing: () => import("./messages/hinglish/landing.json"),
    app: () => import("./messages/hinglish/app.json"),
    hospital: () => import("./messages/hinglish/hospital.json"),
    styleguide: empty,
  },
};

const loaded = new WeakMap<I18nInstance, Set<string>>();
const wanted = new WeakMap<I18nInstance, Set<MessageGroup>>();

export function createI18n(): I18nInstance {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources: { en: { translation: enCommon } },
    lng: defaultLanguage,
    fallbackLng: defaultLanguage,
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  loaded.set(instance, new Set(["en:common"]));
  wanted.set(instance, new Set<MessageGroup>(["common"]));
  return instance;
}

export async function loadMessageGroups(instance: I18nInstance, language: LanguageCode, groups: readonly MessageGroup[]): Promise<void> {
  const done = loaded.get(instance) ?? new Set<string>();
  loaded.set(instance, done);
  const requested = wanted.get(instance) ?? new Set<MessageGroup>();
  wanted.set(instance, requested);
  for (const group of groups) requested.add(group);

  const languagesToLoad = language === defaultLanguage ? [defaultLanguage] : [defaultLanguage, language];
  await Promise.all(
    languagesToLoad.flatMap((code) =>
      groups.map(async (group) => {
        const key = `${code}:${group}`;
        if (done.has(key)) return;
        done.add(key);
        const module = await loaders[code][group]();
        instance.addResourceBundle(code, "translation", module.default, true, false);
      }),
    ),
  );
}

export async function ensureLanguageLoaded(instance: I18nInstance, language: LanguageCode): Promise<void> {
  await loadMessageGroups(instance, language, [...(wanted.get(instance) ?? ["common"])]);
}

export { languages, languageCodes, defaultLanguage, isLanguageCode } from "./languages";
export type { LanguageCode, LanguageInfo, SpeechToTextMode } from "./languages";
