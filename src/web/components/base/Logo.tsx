import { useId } from "react";
import { cn } from "../../lib/cn";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className={cn("inline-block shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4C8274" />
          <stop offset="1" stopColor="#2A5248" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill={`url(#${id}-bg)`} />
      <circle cx="32" cy="32" r="30.25" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="1.5" />
      <path d="M21 15v34M43 15v34" fill="none" stroke="#FFFFFF" strokeWidth="5.2" strokeLinecap="round" />
      <path d="M21 33h7l3-9 4 18 3-9h5" fill="none" stroke="#CFE8DC" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 28, name, className }: { size?: number; name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-serif leading-none tracking-[-0.02em] text-ink", className)} style={{ fontSize: size }}>
      <LogoMark size={Math.round(size * 1.1)} />
      {name}
    </span>
  );
}
