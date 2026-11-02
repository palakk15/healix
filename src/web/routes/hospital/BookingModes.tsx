import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { Chip } from "../../components/base/Chip";
import { dashboardKey, useHospitalLive } from "../../hooks/useHospitalLive";

export default function BookingModes() {
  const { t } = useTranslation();
  useHospitalLive();
  const modes = useQuery({ queryKey: [...dashboardKey, "modes"], queryFn: () => backend.dashboard.bookingModes(), refetchInterval: 3000, retry: 1 });
  const previous = useRef<Record<string, string>>({});
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!modes.data) return;
    const next: Record<string, boolean> = {};
    for (const entry of modes.data.modes) {
      const before = previous.current[entry.doctor_id];
      if (before && before !== entry.mode) next[entry.doctor_id] = true;
      previous.current[entry.doctor_id] = entry.mode;
    }
    if (Object.keys(next).length > 0) {
      setFlipped((current) => ({ ...current, ...next }));
      const timer = setTimeout(() => setFlipped({}), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [modes.data]);

  return (
    <main id="main" className="flex flex-col gap-5">
      <header>
        <h1 className="type-h2">{t("hospital.modes.title")}</h1>
        <p className="type-small mt-1">{t("hospital.modes.hint")}</p>
      </header>
      {modes.isPending ? (
        <p role="status" className="type-body">{t("hospital.loading")}</p>
      ) : modes.isError ? (
        <p role="alert" className="type-body">{t("hospital.error")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-live="polite">
          {modes.data.modes.map((entry) => (
            <li
              key={entry.doctor_id}
              data-testid={`mode-${entry.doctor_id}`}
              data-mode={entry.mode}
              className={`flex flex-col gap-3 rounded-card border bg-surface p-5 shadow-card transition-colors motion-reduce:transition-none ${flipped[entry.doctor_id] ? "border-watch-text" : "border-line"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="type-h3 !text-[18px] !leading-[24px]">{entry.name}</h2>
                <Chip tone={entry.mode === "pessimistic" ? "watch" : "soft"}>{t(`hospital.modes.${entry.mode}`)}</Chip>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="type-label">{t("hospital.modes.buffer")}</dt>
                  <dd className="type-data">{t("hospital.minutes", { minutes: entry.slot_buffer_minutes })}</dd>
                </div>
                <div>
                  <dt className="type-label">{t("hospital.modes.predicted")}</dt>
                  <dd className="type-data">{t("hospital.minutes", { minutes: Math.round(entry.predicted_wait_minutes) })}</dd>
                </div>
              </dl>
              <p className="type-small">{entry.reason}</p>
              {flipped[entry.doctor_id] ? <p role="status" className="type-small font-medium text-watch-text">{t("hospital.modes.changed")}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
