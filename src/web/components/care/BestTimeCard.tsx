import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { Card } from "../base/Card";

export function BestTimeCard({ doctorId }: { doctorId: string }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ["best-times", doctorId], queryFn: () => backend.bestTimes(doctorId), retry: 1 });
  if (!query.data) return null;
  const times = query.data.times.filter((entry) => entry.minutes_saved > 0);

  return (
    <Card tint="stage" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Clock size={20} strokeWidth={1.75} className="text-accent" aria-hidden="true" />
        <h2 className="type-h3">{t("doctors.bestTime.title")}</h2>
      </div>
      {times.length === 0 ? (
        <p className="type-small">{t("doctors.bestTime.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {times.map((entry) => (
            <li key={entry.hour} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
              <span className="type-data text-ink">{entry.label}</span>
              <span className="type-small">{t("doctors.bestTime.saves", { minutes: entry.minutes_saved })}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="type-small">{t("doctors.bestTime.note")}</p>
    </Card>
  );
}
