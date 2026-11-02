import { useEffect, useState } from "react";
import { motionTokens } from "@core/tokens";
import { reasoningStepKinds, type ReasoningStepKind } from "@core/domain/triage";
import { cn } from "../../lib/cn";

const dotClass: Record<ReasoningStepKind, string> = {
  input: "bg-ink",
  safety: "bg-ok",
  conclusion: "bg-accent",
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface ReasoningTrailProps {
  steps: readonly string[];
  animate?: boolean;
  stepDelayMs?: number;
  className?: string;
}

export function ReasoningTrail({ steps, animate = true, stepDelayMs = motionTokens.reasoningStepMs, className }: ReasoningTrailProps) {
  const instant = !animate || prefersReducedMotion();
  const [visible, setVisible] = useState(instant ? steps.length : Math.min(1, steps.length));

  useEffect(() => {
    if (instant) {
      setVisible(steps.length);
      return undefined;
    }
    if (visible >= steps.length) return undefined;
    const timer = setTimeout(() => setVisible((count) => count + 1), stepDelayMs);
    return () => clearTimeout(timer);
  }, [instant, steps.length, stepDelayMs, visible]);

  const kinds = reasoningStepKinds(steps.length);

  return (
    <ol aria-live="polite" className={cn("m-0 list-none p-0", className)}>
      {steps.slice(0, visible).map((step, index) => (
        <li
          key={`${index}-${step}`}
          data-kind={kinds[index]}
          className={cn("relative pb-5 pl-8 last:pb-0", !instant && "animate-[trail-in_400ms_var(--ease)_both]")}
        >
          {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-px bg-line" /> : null}
          <span aria-hidden="true" className={cn("absolute left-0 top-1.5 size-[15px] rounded-full border-[3px] border-surface", dotClass[kinds[index] ?? "safety"])} />
          <p className="type-body text-ink">{step}</p>
        </li>
      ))}
    </ol>
  );
}

export function ReasoningTrailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="m-0 p-0">
      {[78, 64, 70].map((width, index) => (
        <div key={index} className="relative pb-5 pl-8 last:pb-0">
          {index < 2 ? <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-px bg-line" /> : null}
          <span aria-hidden="true" className="absolute left-0 top-1.5 size-[15px] animate-pulse rounded-full border-[3px] border-surface bg-line" />
          <div className="h-4 animate-pulse rounded-pill bg-line" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}
