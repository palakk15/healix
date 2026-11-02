import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useMeta } from "@core/hooks/useMeta";
import { Chip } from "../components/base/Chip";
import { DataProviders } from "../components/layout/DataProviders";
import { PageFallback } from "../components/layout/PageFallback";
import { SkipLink } from "../components/layout/SkipLink";
import { cn } from "../lib/cn";
import { sessionStore, useSession } from "../store";

const sections = [
  { to: "/hospital", labelKey: "hospital.overview", end: true },
  { to: "/hospital/queues", labelKey: "hospital.liveQueues" },
  { to: "/hospital/analytics", labelKey: "hospital.analytics" },
  { to: "/hospital/booking-modes", labelKey: "hospital.bookingModes" },
  { to: "/hospital/simulator", labelKey: "hospital.simulator" },
  { to: "/hospital/alerts", labelKey: "hospital.preAlerts" },
];

function HospitalShell() {
  const { t } = useTranslation();
  const role = useSession((state) => state.role);
  const meta = useMeta();

  if (role !== "staff") {
    if (meta.isPending) return <PageFallback />;
    return <Navigate to={meta.data?.data_mode === "mock" ? "/" : "/hospital/login"} replace />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <SkipLink />
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 md:px-8">
          <span className="type-h3">{t("hospital.title")}</span>
          <div className="flex items-center gap-3">
            {meta.data?.data_mode === "mock" ? <Chip tone="watch">{t("hospital.demoData")}</Chip> : null}
            <button
              type="button"
              onClick={() => {
                sessionStore.getState().signOut();
                window.location.assign("/");
              }}
              className="type-small inline-flex min-h-11 items-center rounded-pill border border-line px-4 font-medium text-ink hover:border-ink-3"
            >
              {t("hospital.signOut")}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-8 md:grid-cols-[220px_1fr] md:px-8">
        <nav aria-label={t("nav.primary")}>
          <ul className="flex gap-2 overflow-x-auto md:flex-col">
            {sections.filter((section) => section.to !== "/hospital/simulator" || meta.data?.data_mode === "mock").map(({ to, labelKey, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "touch-target flex items-center whitespace-nowrap rounded-small px-4 text-[15px]",
                      isActive ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
                    )
                  }
                >
                  {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function HospitalLayout() {
  return (
    <DataProviders>
      <HospitalShell />
    </DataProviders>
  );
}
