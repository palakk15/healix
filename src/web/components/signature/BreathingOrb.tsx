import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface BreathingOrbProps {
  label?: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  size?: number;
  rings?: readonly number[];
  ringsClassName?: string;
  className?: string;
}

export function BreathingOrb({ label, value, sub, size = 240, rings = [], ringsClassName, className }: BreathingOrbProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      {rings.map((diameter, index) => (
        <span
          key={diameter}
          aria-hidden="true"
          className={cn("pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border", ringsClassName)}
          style={{
            width: diameter,
            height: diameter,
            borderColor: index === rings.length - 1 && rings.length > 2 ? "rgba(63,111,99,.10)" : "rgba(63,111,99,.16)",
          }}
        />
      ))}
      <div
        className="orb-breathe flex size-full flex-col items-center justify-center rounded-full text-center shadow-orb"
        style={{ background: "var(--gradient-orb)" }}
      >
        {label ? <span className="type-label text-ink-3-text">{label}</span> : null}
        {value ? (
          <span className="mb-1 mt-1.5 font-serif text-[56px] leading-[56px] tracking-[-0.02em] text-ink">{value}</span>
        ) : null}
        {sub ? <span className="type-small">{sub}</span> : null}
      </div>
    </div>
  );
}
