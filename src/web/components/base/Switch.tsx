import { cn } from "../../lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  describedBy?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, describedBy, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-11 w-14 shrink-0 items-center justify-center", className)}
    >
      <span aria-hidden="true" className={cn("relative h-7 w-12 rounded-pill border border-line transition-colors", checked ? "bg-accent" : "bg-surface")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full transition-all", checked ? "left-[26px] bg-surface" : "left-0.5 bg-ink-3-text")} />
      </span>
    </button>
  );
}
