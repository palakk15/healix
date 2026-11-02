import { useState } from "react";
import { Check, Download, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { parchiText } from "@core/domain/reportView";
import { cn } from "../../lib/cn";

export interface ParchiProps {
  questions: readonly string[];
  title?: string;
  className?: string;
}

const actionStyle =
  "type-button inline-flex h-11 min-w-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-ink hover:border-ink-3";

export function Parchi({ questions, title, className }: ParchiProps) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<"saved" | "copied" | null>(null);
  const heading = title ?? t("parchi.title");
  const text = parchiText(heading, questions);

  function save() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "questions-for-my-doctor.txt";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("saved");
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: heading, text });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice("copied");
    } catch {
      setNotice(null);
    }
  }

  return (
    <section
      aria-label={heading}
      data-testid="parchi"
      className={cn("rounded-card border border-line bg-surface p-6 shadow-card md:p-8", className)}
    >
      <h3 className="type-h3">{heading}</h3>
      <ol
        className="relative mt-4 border-l border-peach pl-5"
        style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 35px, var(--color-line) 35px, var(--color-line) 36px)", backgroundSize: "100% 36px" }}
      >
        {questions.map((question, index) => (
          <li key={question} className="type-quote !text-[20px] !leading-[36px] md:!text-[24px]">
            <span className="sr-only">{index + 1}. </span>
            {question}
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} className={actionStyle}>
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          {t("parchi.save")}
        </button>
        <button type="button" onClick={() => void share()} className={actionStyle}>
          <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
          {t("parchi.share")}
        </button>
        <span role="status" aria-live="polite" className="type-small inline-flex items-center gap-1.5 text-accent-soft-text">
          {notice ? (
            <>
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              {t(notice === "saved" ? "parchi.saved" : "parchi.copied")}
            </>
          ) : null}
        </span>
      </div>
    </section>
  );
}
