import { useTranslation } from "react-i18next";
import type { Citation } from "@core/api/schemas/ai";
import { splitCitations } from "@core/domain/citations";

export interface CitedTextProps {
  text: string;
  citations: readonly Citation[];
  onOpen: (citation: Citation) => void;
}

export function CitedText({ text, citations, onOpen }: CitedTextProps) {
  const { t } = useTranslation();
  return (
    <p className="type-body whitespace-pre-wrap">
      {splitCitations(text).map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.value}</span>;
        const citation = citations.find((entry) => entry.n === part.n);
        if (!citation) {
          return (
            <sup key={index} className="ml-0.5 text-[11px] text-ink-3-text">
              [{part.n}]
            </sup>
          );
        }
        return (
          <sup key={index} className="ml-0.5">
            <button
              type="button"
              onClick={() => onOpen(citation)}
              aria-label={t("assistant.openSource", { n: part.n, title: citation.title })}
              className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-pill bg-accent-soft px-1.5 text-[12px] font-medium text-accent-soft-text hover:bg-accent hover:text-surface"
            >
              {part.n}
            </button>
          </sup>
        );
      })}
    </p>
  );
}
