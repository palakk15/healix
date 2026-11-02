import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ai, reports } from "@core/api/ai";
import { ApiError } from "@core/api/error";
import { formatIndiaDate } from "@core/domain/format";
import { buildRangeBar } from "@core/domain/reportRange";
import { splitExplainItems } from "@core/domain/reportView";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { Chip } from "../../components/base/Chip";
import { Disclaimer } from "../../components/base/Disclaimer";
import { ReferenceText } from "../../components/reports/ReferenceText";
import { Sparkline } from "../../components/reports/Sparkline";
import { ListenButton } from "../../components/signature/ListenButton";
import { Parchi } from "../../components/signature/Parchi";
import { RangeBar } from "../../components/signature/RangeBar";
import { usePreferences } from "../../store";

export default function ReportExplain() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const language = usePreferences((state) => state.language);
  const elderMode = usePreferences((state) => state.elderMode);
  const report = useQuery({ queryKey: ["report", id], queryFn: () => reports.get(id), retry: 1 });
  const explain = useQuery({
    queryKey: ["explain", id, language],
    queryFn: () => ai.explain(id, language),
    retry: (count, error) => !(error instanceof ApiError && error.status === 409) && count < 1,
  });

  if (explain.isPending || report.isPending) {
    return <main id="main" className="px-5 py-8"><p role="status" className="type-body">{t("reports.explain.loading")}</p></main>;
  }

  if (explain.isError && explain.error instanceof ApiError && explain.error.status === 409) {
    return (
      <main id="main" className="flex flex-col gap-4 px-5 py-8">
        <h1 className="type-h2">{t("reports.explain.reviewFirstTitle")}</h1>
        <p className="type-body">{t("reports.explain.reviewFirst")}</p>
        <Button to={`/app/reports/${id}/review`}>{t("reports.explain.goReview")}</Button>
      </main>
    );
  }

  if (explain.isError || report.isError) {
    return <main id="main" className="px-5 py-8"><p role="alert" className="type-body">{t("reports.explain.error")}</p></main>;
  }

  const data = explain.data;
  const observations = new Map(report.data.observations.map((observation) => [observation.code, observation]));
  const { flagged, normal } = splitExplainItems(data.items);
  const duplicates = new Map(data.duplicates.map((entry) => [entry.code, entry]));
  const normalNames = normal.map((item) => observations.get(item.code)?.display ?? item.code).join(", ");
  const listenText = [data.summary, ...flagged.map((item) => item.meaning)].join(" ");

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <header>
        <h1 className="type-h2">{report.data.report_type}</h1>
        <p className="type-small mt-1">{t("reports.explain.fromLab", { lab: report.data.lab_name, date: formatIndiaDate(report.data.issued_at) })}</p>
      </header>

      <section aria-label={t("reports.explain.summary")} className="rounded-card bg-ink p-6 text-bg shadow-card md:p-8">
        <p className="type-label !text-bg/70">{t("reports.explain.summary")}</p>
        <p className="type-body mt-3 !text-bg">{data.summary}</p>
        <div className="mt-4">
          <ListenButton text={listenText} language={language} autoPlay={elderMode} />
        </div>
      </section>

      {flagged.map((item) => {
        const observation = observations.get(item.code);
        if (!observation) return null;
        const bar = buildRangeBar(observation.reference, observation.value);
        const history = item.history ?? [];
        const first = history[0];
        const last = history[history.length - 1];
        const duplicate = duplicates.get(item.code);
        return (
          <Card as="article" key={item.code} aria-label={observation.display} className="flex flex-col gap-4 !p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="type-h3">{observation.display}</h2>
                <p className="type-data mt-1 text-ink">
                  <span data-testid={`value-${item.code}`}>{observation.value}</span> {observation.unit}
                </p>
              </div>
              <Chip tone="watch">{t(`reports.explain.direction.${item.direction}`)}</Chip>
            </div>
            <RangeBar
              segments={bar.segments}
              value={observation.value}
              min={bar.min}
              max={bar.max}
              label={t("reports.explain.rangeLabel", { name: observation.display, value: observation.value, unit: observation.unit })}
            />
            <p className="type-small -mt-2">
              <ReferenceText observation={observation} />
            </p>
            <p className="type-body">{item.meaning}</p>
            {first && last && history.length > 1 ? (
              <div className="flex items-center gap-4">
                <Sparkline
                  points={history}
                  label={t("reports.explain.trendLabel", { name: observation.display, from: first.value, to: last.value })}
                />
                <p className="type-small">{t("reports.explain.trend", { from: first.value, to: last.value, unit: observation.unit })}</p>
              </div>
            ) : null}
            {duplicate ? (
              <p role="note" className="type-small rounded-[12px] bg-accent-soft px-4 py-3 text-accent-soft-text">
                {t("reports.explain.duplicate", { days: duplicate.days_ago })}
              </p>
            ) : null}
          </Card>
        );
      })}

      {normal.length > 0 ? (
        <p data-testid="normal-line" className="type-body rounded-card border border-line bg-surface px-5 py-4">
          {t("reports.explain.normalLine", { names: normalNames })}
        </p>
      ) : null}

      {data.doctor_questions.length > 0 ? <Parchi questions={data.doctor_questions} /> : null}

      <section aria-label={t("reports.explain.seekCareTitle")} className="rounded-card border border-line bg-surface p-5">
        <h2 className="type-h3">{t("reports.explain.seekCareTitle")}</h2>
        <p className="type-body mt-2">{data.seek_care_if}</p>
      </section>

      <Button to="/app/assistant" variant="secondary">{t("reports.explain.askAssistant")}</Button>
      <Button to="/app/doctors?specialty=General%20Physician&urgency=routine">{t("reports.explain.consult")}</Button>
      <Disclaimer text={data.disclaimer} />
    </main>
  );
}
