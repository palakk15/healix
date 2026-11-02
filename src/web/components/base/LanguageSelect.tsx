import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { languageCodes, languages } from "@core/i18n";
import type { LanguageCode } from "@core/i18n/languages";
import { cn } from "../../lib/cn";
import { preferencesStore, usePreferences } from "../../store";

export function LanguageSelect({ className }: { className?: string }) {
  const { t } = useTranslation();
  const active = usePreferences((state) => state.language);
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <Globe size={18} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3.5 text-ink-2" />
      <select
        aria-label={t("nav.language")}
        value={active}
        lang={languages[active].htmlLang}
        onChange={(event) => preferencesStore.getState().setLanguage(event.target.value as LanguageCode)}
        className="h-11 min-w-[132px] cursor-pointer appearance-none rounded-pill border border-line bg-surface pl-10 pr-9 text-[15px] text-ink outline-none hover:border-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {languageCodes.map((code) => (
          <option key={code} value={code} lang={languages[code].htmlLang}>
            {languages[code].nativeLabel}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-4 text-[11px] text-ink-2">▾</span>
    </label>
  );
}
