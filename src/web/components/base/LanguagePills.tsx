import { languageCodes, languages } from "@core/i18n";
import { cn } from "../../lib/cn";
import { preferencesStore, usePreferences } from "../../store";

export function LanguagePills({ className, label }: { className?: string; label: string }) {
  const active = usePreferences((state) => state.language);
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap justify-center gap-2", className)}>
      {languageCodes.map((code) => {
        const selected = code === active;
        return (
          <button
            key={code}
            type="button"
            lang={languages[code].htmlLang}
            aria-pressed={selected}
            onClick={() => preferencesStore.getState().setLanguage(code)}
            className={cn(
              "relative h-7 rounded-pill border px-3 text-[13px] leading-[26px] after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
              selected
                ? "border-ink bg-ink text-bg"
                : "border-line bg-surface/60 text-ink-2 hover:border-ink-3",
            )}
          >
            {languages[code].nativeLabel}
          </button>
        );
      })}
    </div>
  );
}
