import { useTranslation } from "react-i18next";
import { languageCodes, languages } from "@core/i18n/languages";
import { cn } from "../../lib/cn";
import { preferencesStore, usePreferences } from "../../store";
import { Button } from "../base/Button";
import { StepFrame } from "./StepFrame";

export function LanguageStep({ total, onNext }: { total: number; onNext: () => void }) {
  const { t } = useTranslation();
  const active = usePreferences((state) => state.language);
  return (
    <StepFrame step={0} total={total} title={t("onboarding.language.title")} body={t("onboarding.language.body")}>
      <div role="radiogroup" aria-label={t("onboarding.language.title")} className="grid grid-cols-2 gap-3">
        {languageCodes.map((code) => {
          const selected = code === active;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={languages[code].htmlLang}
              onClick={() => preferencesStore.getState().setLanguage(code)}
              className={cn(
                "flex min-h-[120px] items-center justify-center rounded-card border p-4 text-center font-serif text-[34px] leading-[40px] shadow-card",
                languages[code].usesDevanagari && "font-[Mukta] text-[32px]",
                selected ? "border-ink bg-surface text-ink ring-1 ring-ink" : "border-line bg-surface text-ink-2 hover:border-ink-3",
              )}
            >
              {languages[code].nativeLabel}
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-8">
        <Button className="w-full" onClick={onNext}>
          {t("common.continue")}
        </Button>
      </div>
    </StepFrame>
  );
}
