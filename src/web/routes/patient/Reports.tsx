import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { reports } from "@core/api/ai";
import type { ReportListItem } from "@core/api/schemas/ai";
import { formatIndiaDate } from "@core/domain/format";
import { activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Chip } from "../../components/base/Chip";
import { useSession } from "../../store";

function destination(report: ReportListItem): string | null {
  if (report.status === "confirmed") return `/app/reports/${report.id}`;
  if (report.status === "ready_for_review") return `/app/reports/${report.id}/review`;
  return null;
}

function ReportCard({ report }: { report: ReportListItem }) {
  const { t } = useTranslation();
  const to = destination(report);
  const body = (
    <>
      <FileText size={22} strokeWidth={1.75} className="mt-1 shrink-0 text-accent" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="type-h3">{report.report_type}</span>
        <span className="type-small">
          {report.lab_name} · {formatIndiaDate(report.issued_at)}
        </span>
        <span className="mt-2 flex flex-wrap gap-2">
          {report.status === "confirmed" ? (
            <Chip tone={report.flag_count > 0 ? "watch" : "soft"}>
              {report.flag_count > 0 ? t("reports.list.flags", { count: report.flag_count }) : t("reports.list.allInRange")}
            </Chip>
          ) : (
            <Chip tone="outline">{t(`reports.status.${report.status}`)}</Chip>
          )}
        </span>
      </span>
    </>
  );
  const classes = "flex items-start gap-4 rounded-card border border-line bg-surface p-5 shadow-card";
  return to ? (
    <Link to={to} className={`${classes} hover:border-ink-3`}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export default function Reports() {
  const { t } = useTranslation();
  const profile = useSession((state) => activeProfile(state));
  const list = useQuery({
    queryKey: ["reports", profile?.id],
    enabled: Boolean(profile),
    queryFn: () => reports.list(profile?.id),
    retry: 1,
  });

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="type-h2">{t("reports.list.title")}</h1>
          {profile ? <p className="type-small mt-1">{t("reports.list.forWho", { name: profile.name })}</p> : null}
        </div>
        <Button to="/app/reports/upload" size="sm">
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          {t("reports.list.uploadShort")}
        </Button>
      </header>

      {list.isPending ? (
        <p role="status" className="type-body">{t("reports.list.loading")}</p>
      ) : list.isError ? (
        <p role="alert" className="type-body">{t("reports.list.error")}</p>
      ) : list.data.length === 0 ? (
        <section className="rounded-card border border-line bg-surface p-6 shadow-card">
          <h2 className="type-h3">{t("reports.list.empty")}</h2>
          <p className="type-body mt-2">{t("reports.list.emptyHint")}</p>
          <Button to="/app/reports/upload" className="mt-5">
            {t("reports.list.upload")}
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-4" aria-label={t("reports.list.title")}>
          {list.data.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
