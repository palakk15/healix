import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { reports } from "@core/api/ai";
import { allValues, draftFrom, invalidCodes, isLowConfidence, type ValueDraft } from "@core/domain/reportView";
import { Button } from "../../components/base/Button";
import { Chip } from "../../components/base/Chip";
import { ReferenceText } from "../../components/reports/ReferenceText";
import { ReportImage, type ReportMarker } from "../../components/reports/ReportImage";
import { cn } from "../../lib/cn";

export default function ReportReview() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["report", id], queryFn: () => reports.get(id), retry: 1 });
  const [draft, setDraft] = useState<ValueDraft>({});
  const [showInvalid, setShowInvalid] = useState(false);
  const observations = useMemo(() => report.data?.observations ?? [], [report.data]);

  useEffect(() => {
    if (report.data) setDraft(draftFrom(report.data.observations));
  }, [report.data]);

  const confirm = useMutation({
    mutationFn: () => reports.confirm(id, allValues(observations, draft)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["report", id] });
      navigate(`/app/reports/${id}`);
    },
  });

  const invalid = invalidCodes(draft);
  const markers: ReportMarker[] = observations.flatMap((observation) =>
    observation.bbox ? [{ code: observation.code, bbox: observation.bbox, attention: isLowConfidence(observation) }] : [],
  );
  const lowCount = observations.filter(isLowConfidence).length;

  function submit() {
    if (invalid.length > 0) {
      setShowInvalid(true);
      return;
    }
    confirm.mutate();
  }

  if (report.isPending) return <main id="main" className="px-5 py-8"><p role="status" className="type-body">{t("reports.review.loading")}</p></main>;
  if (report.isError) return <main id="main" className="px-5 py-8"><p role="alert" className="type-body">{t("reports.review.error")}</p></main>;
  if (report.data.status === "uploaded" || report.data.status === "processing") {
    return (
      <main id="main" className="flex flex-col gap-4 px-5 py-8">
        <h1 className="type-h2">{t("reports.review.title")}</h1>
        <p className="type-body">{t("reports.review.notReady")}</p>
        <Button to="/app/reports" variant="secondary">{t("reports.review.back")}</Button>
      </main>
    );
  }

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="type-h2">{t("reports.review.title")}</h1>
        <p className="type-body">{t("reports.review.body")}</p>
        {lowCount > 0 ? (
          <p role="status" className="type-small inline-flex items-center gap-2 font-medium text-watch-text">
            <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
            {t("reports.review.checkCount", { count: lowCount })}
          </p>
        ) : null}
      </header>

      <section aria-label={t("reports.review.original")} className="flex flex-col gap-2">
        <h2 className="type-label">{t("reports.review.original")}</h2>
        <ReportImage reportId={id} markers={markers} />
      </section>

      <section aria-label={t("reports.review.extracted")} className="flex flex-col gap-3">
        <h2 className="type-label">{t("reports.review.extracted")}</h2>
        {observations.length === 0 ? <p data-testid="no-values" className="type-body rounded-card border border-line bg-stage p-5">{t("reports.review.noValues")}</p> : null}
        <ul className="flex flex-col gap-3">
          {observations.map((observation) => {
            const low = isLowConfidence(observation);
            const bad = showInvalid && invalid.includes(observation.code);
            const inputId = `value-${observation.code}`;
            return (
              <li
                key={observation.code}
                data-testid={`row-${observation.code}`}
                data-attention={low}
                className={cn("flex flex-col gap-2 rounded-card border bg-surface p-4 shadow-card", low ? "border-watch-text/60 bg-watch-tint" : "border-line")}
              >
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor={inputId} className="type-h3">{observation.display}</label>
                  {low ? <Chip tone="watch">{t("reports.review.pleaseCheck")}</Chip> : null}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id={inputId}
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft[observation.code] ?? ""}
                    aria-invalid={bad}
                    aria-describedby={`${inputId}-ref`}
                    onChange={(event) => setDraft((current) => ({ ...current, [observation.code]: event.target.value }))}
                    className="type-data h-12 w-32 rounded-[12px] border border-line bg-white px-3 text-ink"
                  />
                  <span className="type-data text-ink-3-text">{observation.unit}</span>
                </div>
                <p id={`${inputId}-ref`} className="type-small">
                  <ReferenceText observation={observation} />
                </p>
                {bad ? <p role="alert" className="type-small font-medium text-ink">{t("reports.review.invalid", { name: observation.display })}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>

      {confirm.isError ? <p role="alert" className="type-body">{t("reports.review.confirmFailed")}</p> : null}
      <Button onClick={submit} disabled={confirm.isPending} aria-busy={confirm.isPending}>
        {confirm.isPending ? t("reports.review.confirming") : t("reports.review.confirm")}
      </Button>
    </main>
  );
}
