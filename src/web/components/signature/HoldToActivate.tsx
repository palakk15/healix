import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../../lib/cn";

export const defaultHoldMs = 2000;

export interface HoldToActivateProps {
  onActivate: () => void;
  label: string;
  hint?: string;
  holdingLabel: string;
  durationMs?: number;
  variant?: "bar" | "round";
  disabled?: boolean;
  centerText?: string;
  className?: string;
}

const tickMs = 30;
const ringRadius = 70;
const ringLength = 2 * Math.PI * ringRadius;

export function HoldToActivate({
  onActivate,
  label,
  hint,
  holdingLabel,
  durationMs = defaultHoldMs,
  variant = "bar",
  disabled = false,
  centerText = "SOS",
  className,
}: HoldToActivateProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fired = useRef(false);
  const hintId = useId();

  const stopTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (fired.current) return;
    stopTimer();
    setProgress(0);
    setHolding(false);
  }, [stopTimer]);

  const start = useCallback(() => {
    if (disabled || timer.current) return;
    fired.current = false;
    startedAt.current = Date.now();
    setHolding(true);
    timer.current = setInterval(() => {
      const ratio = Math.min((Date.now() - startedAt.current) / durationMs, 1);
      setProgress(ratio);
      if (ratio >= 1 && !fired.current) {
        fired.current = true;
        stopTimer();
        setHolding(false);
        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(40);
        onActivate();
        setTimeout(() => {
          fired.current = false;
          setProgress(0);
        }, 400);
      }
    }, tickMs);
  }, [disabled, durationMs, onActivate, stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    start();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      start();
    }
  };

  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") cancel();
  };

  const common = {
    type: "button" as const,
    "aria-label": hint ? `${label}. ${hint}` : label,
    "aria-describedby": hint ? hintId : undefined,
    disabled,
    onPointerDown,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    onKeyDown,
    onKeyUp,
    onBlur: cancel,
  };

  const status = (
    <span role="status" className="sr-only">
      {holding ? holdingLabel : ""}
    </span>
  );

  if (variant === "round") {
    return (
      <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
        <button
          {...common}
          data-testid="hold-button"
          className="relative flex size-[160px] touch-none select-none items-center justify-center rounded-full"
        >
          <svg viewBox="0 0 160 160" aria-hidden="true" className="absolute inset-0 -rotate-90">
            <circle cx="80" cy="80" r={ringRadius} fill="none" stroke="var(--emergency-border)" strokeWidth="6" />
            <circle
              data-testid="hold-ring"
              cx="80"
              cy="80"
              r={ringRadius}
              fill="none"
              stroke="var(--emergency-text)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - progress)}
            />
          </svg>
          <span className="flex size-[124px] items-center justify-center rounded-full bg-emergency-fill text-[22px] font-medium text-emergency-text">{centerText}</span>
        </button>
        <p className="type-body text-ink">{holding ? holdingLabel : label}</p>
        {hint ? (
          <p id={hintId} className="type-small max-w-[280px]">
            {hint}
          </p>
        ) : null}
        {status}
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        {...common}
        data-testid="hold-button"
        className="relative flex min-h-16 w-full touch-none select-none items-center gap-4 overflow-hidden rounded-pill border border-emergency-border bg-emergency-fill px-6 text-left text-emergency-text"
      >
        <span aria-hidden="true" data-testid="hold-fill" className="absolute inset-y-0 left-0 bg-emergency-border/70" style={{ width: `${progress * 100}%` }} />
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-emergency-border bg-surface text-[13px] font-medium">SOS</span>
        <span className="relative">
          <span className="type-h3 block !text-emergency-text">{holding ? holdingLabel : label}</span>
          {hint ? (
            <span id={hintId} className="type-small block !text-emergency-text">
              {hint}
            </span>
          ) : null}
        </span>
      </button>
      {status}
    </div>
  );
}
