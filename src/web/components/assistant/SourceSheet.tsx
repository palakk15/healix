import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Citation } from "@core/api/schemas/ai";
import { Sheet } from "../care/Sheet";

export interface SourceSheetProps {
  citation: Citation | null;
  onClose: () => void;
}

export function SourceSheet({ citation, onClose }: SourceSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={citation !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={citation?.title ?? t("assistant.source")}
      description={t("assistant.sourceHint")}
    >
      {citation ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="type-label">{t("assistant.section")}</dt>
            <dd className="type-body">{citation.section}</dd>
            <dt className="type-label">{t("assistant.page")}</dt>
            <dd className="type-body">{citation.page}</dd>
            <dt className="type-label">{t("assistant.year")}</dt>
            <dd className="type-body">{citation.year}</dd>
          </dl>
          {citation.excerpt ? <blockquote className="type-small whitespace-pre-line rounded-small bg-stage px-4 py-3">{citation.excerpt}</blockquote> : null}
          <a
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="type-button inline-flex h-12 items-center justify-center gap-2 rounded-pill border border-line bg-surface px-6 text-ink hover:border-ink-3"
          >
            {t("assistant.openLink")}
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
          <button type="button" onClick={onClose} className="type-button inline-flex h-12 items-center justify-center rounded-pill bg-ink px-6 text-bg">
            {t("assistant.close")}
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
