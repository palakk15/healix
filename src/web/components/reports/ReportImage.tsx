import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { useReportImage } from "../../hooks/useReportImage";

export interface ReportMarker {
  code: string;
  bbox: readonly [number, number, number, number];
  attention: boolean;
}

export interface ReportImageProps {
  reportId: string;
  markers: readonly ReportMarker[];
}

export function ReportImage({ reportId, markers }: ReportImageProps) {
  const { t } = useTranslation();
  const image = useReportImage(reportId);

  if (image.failed) return <p role="alert" className="type-small rounded-card border border-line bg-surface p-5">{t("reports.review.imageFailed")}</p>;
  if (image.url && image.type === "application/pdf") {
    return (
      <object data={image.url} type="application/pdf" aria-label={t("reports.review.imageAlt")} className="h-[70vh] w-full rounded-card border border-line bg-surface">
        <p className="type-small p-5">{t("reports.review.docPreview")}</p>
      </object>
    );
  }
  if (image.url && !image.type.startsWith("image/")) return <p className="type-small rounded-card border border-line bg-surface p-5">{t("reports.review.docPreview")}</p>;
  if (!image.url) return <div aria-hidden="true" className="aspect-[3/4] w-full animate-pulse rounded-card border border-line bg-stage" />;

  return (
    <figure className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <img src={image.url} alt={t("reports.review.imageAlt")} className="block h-auto w-full" />
      {markers.map((marker) => {
        const [x, y, width, height] = marker.bbox;
        return (
          <span
            key={marker.code}
            data-testid={`marker-${marker.code}`}
            data-attention={marker.attention}
            aria-hidden="true"
            className={cn("pointer-events-none absolute rounded-[3px] border", marker.attention ? "border-watch-text bg-watch/40" : "border-accent/50 bg-accent/10")}
            style={{ left: `${(x - 0.005) * 100}%`, top: `${(y - 0.004) * 100}%`, width: `${(width + 0.01) * 100}%`, height: `${(height + 0.008) * 100}%` }}
          />
        );
      })}
    </figure>
  );
}
