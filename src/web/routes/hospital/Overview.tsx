import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { backend } from "@core/api/backend";
import { formatIndiaTime } from "@core/domain/format";
import { StatCard } from "../../components/hospital/StatCard";
import { dashboardKey, useHospitalLive } from "../../hooks/useHospitalLive";

export default function Overview() {
  const { t } = useTranslation();
  useHospitalLive();
  const overview = useQuery({ queryKey: [...dashboardKey, "overview"], queryFn: () => backend.dashboard.overview(), refetchInterval: 10_000, retry: 1 });

  return (
    <main id="main" className="flex flex-col gap-6">
      <header>
        <h1 className="type-h2">{t("hospital.overviewPage.title")}</h1>
        {overview.data ? <p className="type-small mt-1">{t("hospital.overviewPage.updated", { time: formatIndiaTime(overview.data.server_time) })}</p> : null}
      </header>
      {overview.isPending ? (
        <p role="status" className="type-body">{t("hospital.loading")}</p>
      ) : overview.isError ? (
        <p role="alert" className="type-body">{t("hospital.error")}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <StatCard testId="stat-waiting" label={t("hospital.overviewPage.totalWaiting")} value={overview.data.total_waiting} hint={t("hospital.overviewPage.waitingHint")} />
          <StatCard
            testId="stat-average"
            label={t("hospital.overviewPage.averageWait")}
            estimate={t("hospital.estimate")}
            value={t("hospital.minutes", { minutes: Math.round(overview.data.average_wait_minutes) })}
            hint={t("hospital.overviewPage.averageHint")}
          />
          <StatCard
            testId="stat-busiest"
            label={t("hospital.overviewPage.busiestDoctor")}
            value={<span className="type-h3 !text-[26px] !leading-[32px]">{overview.data.busiest_doctor?.name ?? t("hospital.overviewPage.none")}</span>}
            hint={overview.data.busiest_doctor ? t("hospital.overviewPage.waitingCount", { count: overview.data.busiest_doctor.waiting }) : undefined}
          />
        </div>
      )}
    </main>
  );
}
