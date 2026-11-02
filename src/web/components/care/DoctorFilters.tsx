import { useTranslation } from "react-i18next";
import { languageNativeName } from "@core/domain/doctorLanguages";
import { formatRupees } from "@core/domain/format";
import { cn } from "../../lib/cn";

export interface DoctorFilterValues {
  maxFee: number | null;
  maxKm: number | null;
  language: string | null;
}

export const feeOptions = [null, 500, 800, 1200] as const;
export const distanceOptions = [null, 3, 5, 10] as const;

function ChipGroup<Value extends string | number | null>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly Value[];
  value: Value;
  onChange: (value: Value) => void;
  render: (value: Value) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="type-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-pill border px-4 text-[14px] font-medium",
                selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-ink-3",
              )}
            >
              {render(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DoctorFilters({
  value,
  onChange,
  languages,
}: {
  value: DoctorFilterValues;
  onChange: (value: DoctorFilterValues) => void;
  languages: readonly string[];
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <ChipGroup
        label={t("doctors.fee")}
        options={feeOptions}
        value={value.maxFee}
        onChange={(maxFee) => onChange({ ...value, maxFee })}
        render={(option) => (option === null ? t("doctors.anyFee") : t("doctors.upTo", { amount: formatRupees(option) }))}
      />
      <ChipGroup
        label={t("doctors.distance")}
        options={distanceOptions}
        value={value.maxKm}
        onChange={(maxKm) => onChange({ ...value, maxKm })}
        render={(option) => (option === null ? t("doctors.anyDistance") : t("doctors.withinKm", { km: option }))}
      />
      <ChipGroup
        label={t("doctors.language")}
        options={[null, ...languages] as Array<string | null>}
        value={value.language}
        onChange={(language) => onChange({ ...value, language })}
        render={(option) => (option ? languageNativeName(option) : t("doctors.anyLanguage"))}
      />
    </div>
  );
}
