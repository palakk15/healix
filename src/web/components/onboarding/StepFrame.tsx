import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../base/Button";
import { Eyebrow } from "../base/Eyebrow";

export interface StepFrameProps {
  step: number;
  total: number;
  title: string;
  body?: string;
  onBack?: () => void;
  children: ReactNode;
}

export function StepFrame({ step, total, title, body, onBack, children }: StepFrameProps) {
  const { t } = useTranslation();
  return (
    <main id="main" className="flex min-h-screen flex-col px-5 pb-10 pt-8">
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label={t("onboarding.stepOf", { current: step + 1, total })}
        className="h-px w-full bg-line"
      >
        <div className="h-px bg-ink transition-[width] duration-700 ease-calm" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>
      <div className="mt-4 flex min-h-11 items-center justify-between">
        <Eyebrow>{t("onboarding.stepOf", { current: step + 1, total })}</Eyebrow>
        {onBack ? (
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t("common.back")}
          </Button>
        ) : null}
      </div>
      <h1 className="type-h2 mt-4">{title}</h1>
      {body ? <p className="type-body mt-3">{body}</p> : null}
      <div className="mt-8 flex flex-1 flex-col">{children}</div>
    </main>
  );
}
