import { useTranslation } from "react-i18next";
import { knownConditions, toggleCondition } from "@core/domain/conditions";
import { cn } from "../../lib/cn";

export interface ConditionPickerProps {
  value: readonly string[];
  onChange: (next: string[]) => void;
}

export function ConditionPicker({ value, onChange }: ConditionPickerProps) {
  const { t } = useTranslation();
  const extras = value.filter((entry) => !knownConditions.some((known) => known.id === entry));
  return (
    <div role="group" aria-label={t("profileForm.conditions")} className="flex flex-wrap gap-2">
      {knownConditions.map((condition) => {
        const on = value.includes(condition.id);
        return (
          <button
            key={condition.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleCondition(value, condition.id))}
            className={cn(
              "type-small inline-flex min-h-11 items-center rounded-pill border px-4 font-medium",
              on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3",
            )}
          >
            {t(`profileForm.conditionNames.${condition.key}`)}
          </button>
        );
      })}
      {extras.map((entry) => (
        <button
          key={entry}
          type="button"
          aria-pressed="true"
          onClick={() => onChange(toggleCondition(value, entry))}
          className="type-small inline-flex min-h-11 items-center rounded-pill border border-ink bg-ink px-4 font-medium text-bg"
        >
          {entry}
        </button>
      ))}
    </div>
  );
}
