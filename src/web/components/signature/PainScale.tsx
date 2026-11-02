import { Angry, Annoyed, Frown, Meh, Smile, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { painLevels, type PainLevel } from "@core/domain/bodyAreas";
import { cn } from "../../lib/cn";

const faces: Record<PainLevel, LucideIcon> = { 1: Smile, 2: Meh, 3: Frown, 4: Annoyed, 5: Angry };

export interface PainScaleProps {
  value: PainLevel | null;
  onChange: (value: PainLevel | null) => void;
}

export function PainScale({ value, onChange }: PainScaleProps) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("triage.pain.title")} className="grid grid-cols-5 gap-2">
      {painLevels.map((level) => {
        const Face = faces[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${level}: ${t(`triage.pain.level${level}`)}`}
            onClick={() => onChange(selected ? null : level)}
            className={cn(
              "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-small border px-1 py-2",
              selected ? "border-accent bg-accent-soft text-accent-soft-text" : "border-line bg-surface text-ink-2 hover:border-ink-3",
            )}
          >
            <Face size={24} strokeWidth={1.75} aria-hidden="true" />
            <span className="text-[12px] leading-4">{t(`triage.pain.level${level}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
