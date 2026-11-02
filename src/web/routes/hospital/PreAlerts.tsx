import { useQuery } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { formatIndiaTime } from "@core/domain/format";
import { Chip } from "../../components/base/Chip";
import { dashboardKey, useHospitalLive } from "../../hooks/useHospitalLive";

export default function PreAlerts() {
  const { t } = useTranslation();
  useHospitalLive();
  const alerts = useQuery({ queryKey: [...dashboardKey, "alerts"], queryFn: () => backend.dashboard.preAlerts(), refetchInterval: 5000, retry: 1 });
  const list = [...(alerts.data?.alerts ?? [])].sort((a, b) => b.received_at.localeCompare(a.received_at));

  return (
    <main id="main" className="flex flex-col gap-5">
      <header>
        <h1 className="type-h2">{t("hospital.alerts.title")}</h1>
        <p className="type-small mt-1">{t("hospital.alerts.hint")}</p>
      </header>
      {alerts.isPending ? (
        <p role="status" className="type-body">{t("hospital.loading")}</p>
      ) : alerts.isError ? (
        <p role="alert" className="type-body">{t("hospital.error")}</p>
      ) : list.length === 0 ? (
        <p data-testid="no-alerts" className="type-body rounded-card border border-line bg-surface p-6">{t("hospital.alerts.none")}</p>
      ) : (
        <ul aria-live="polite" className="flex flex-col gap-4">
          {list.map((alert) => (
            <li
              key={alert.id}
              data-testid="pre-alert"
              className="alert-in flex flex-col gap-2 rounded-card border border-emergency-border bg-emergency-fill p-5 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Siren size={20} strokeWidth={1.75} aria-hidden="true" className="text-emergency-text" />
                <h2 className="type-h3 !text-[18px] !leading-[24px] !text-emergency-text">{alert.patient_label}</h2>
                <Chip tone="emergency">{t("hospital.alerts.age", { age: alert.age })}</Chip>
              </div>
              <p className="type-body !text-ink">{alert.summary}</p>
              <p className="type-data text-ink">
                {t("hospital.alerts.eta", { minutes: alert.eta_minutes })} · {t("hospital.alerts.received", { time: formatIndiaTime(alert.received_at) })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
