import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlotsResponse } from "@core/api/schemas/backend";
import { formatIndiaTime } from "@core/domain/format";
import { cn } from "../../lib/cn";

export interface SlotPickerProps {
  slots: SlotsResponse;
  value: string | null;
  onChange: (start: string) => void;
  initialDate?: string | null;
}

const dayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function dayName(dateKey: string): string {
  return dayFormatter.format(new Date(`${dateKey}T12:00:00+05:30`));
}

export function SlotPicker({ slots, value, onChange, initialDate }: SlotPickerProps) {
  const { t } = useTranslation();
  const preferred = initialDate ? slots.days.findIndex((day) => day.date === initialDate && day.slots.some((slot) => slot.available)) : -1;
  const firstWithTimes = slots.days.findIndex((day) => day.slots.some((slot) => slot.available));
  const [dayIndex, setDayIndex] = useState(preferred >= 0 ? preferred : Math.max(firstWithTimes, 0));
  const day = slots.days[dayIndex];
  const free = day?.slots.filter((slot) => slot.available) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("booking.title")} className="-mx-1 flex max-w-full gap-1 self-start overflow-x-auto rounded-pill border border-line bg-surface p-1">
        {slots.days.map((entry, index) => (
          <button
            key={entry.date}
            type="button"
            role="tab"
            aria-selected={index === dayIndex}
            onClick={() => setDayIndex(index)}
            className={cn("type-small min-h-10 shrink-0 rounded-pill px-4 font-medium", index === dayIndex ? "bg-ink text-bg" : "text-ink-2")}
          >
            {entry.label === "later" ? dayName(entry.date) : t(`booking.${entry.label}`)}
          </button>
        ))}
      </div>
      {free.length === 0 ? (
        <p className="type-small">{t("booking.noSlots")}</p>
      ) : (
        <div role="radiogroup" aria-label={t("booking.pick")} className="grid grid-cols-3 gap-2">
          {free.map((slot) => {
            const selected = slot.start === value;
            return (
              <button
                key={slot.start}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(slot.start)}
                className={cn(
                  "type-data min-h-11 rounded-small border px-2 text-center",
                  selected ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink hover:border-ink-3",
                )}
              >
                {formatIndiaTime(slot.start)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
