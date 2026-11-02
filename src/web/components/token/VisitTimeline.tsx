import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

const steps = ["booked", "queue", "turn", "done"] as const;

export function currentStep(status: "waiting" | "called" | "completed" | "cancelled"): number {
  if (status === "completed") return 3;
  if (status === "called") return 2;
  return 1;
}

export function VisitTimeline({ status }: { status: "waiting" | "called" | "completed" | "cancelled" }) {
  const { t } = useTranslation();
  const current = currentStep(status);
  return (
    <ol className="flex flex-col" aria-label={t("tokenView.timeline")}>
      {steps.map((step, index) => {
        const done = index < current || (status === "completed" && index === current);
        const active = index === current && status !== "completed";
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 ? <span aria-hidden="true" className={cn("absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px", done ? "bg-accent" : "bg-line")} /> : null}
            <span
              aria-hidden="true"
              className={cn("z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px]", done ? "border-accent bg-accent text-white" : active ? "border-ink bg-surface ring-4 ring-accent-soft" : "border-line bg-surface text-ink-3-text")}
            >
              {done ? <Check size={14} strokeWidth={2.5} /> : index + 1}
            </span>
            <div>
              <p className={cn("type-body", active ? "font-medium text-ink" : done ? "text-ink" : "text-ink-3-text")}>{t(`tokenView.steps.${step}.title`)}</p>
              <p className="type-small">{t(`tokenView.steps.${step}.body`)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
