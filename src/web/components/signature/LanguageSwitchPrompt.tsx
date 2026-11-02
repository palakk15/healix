import { useTranslation } from "react-i18next";
import { languages, type LanguageCode } from "@core/i18n/languages";
import { useTypedLanguage } from "../../hooks/useTypedLanguage";
import { preferencesStore, usePreferences } from "../../store";
import { Button } from "../base/Button";

export interface LanguageSwitchPromptProps {
  text: string;
  hint?: LanguageCode | null;
}

export function LanguageSwitchPrompt({ text, hint }: LanguageSwitchPromptProps) {
  const { t } = useTranslation();
  const uiLanguage = usePreferences((state) => state.language);
  const { suggested, dismiss } = useTypedLanguage(text, uiLanguage, { hint });

  if (!suggested) return null;
  const nativeName = languages[suggested].nativeLabel;

  return (
    <div role="status" className="mx-auto mt-3 flex max-w-[640px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
      <p className="type-small">{t("voice.switchPrompt", { language: nativeName })}</p>
      <div className="flex gap-1">
        <Button size="sm" onClick={() => preferencesStore.getState().setLanguage(suggested)}>
          {t("voice.switch")}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t("voice.keep")}
        </Button>
      </div>
    </div>
  );
}
