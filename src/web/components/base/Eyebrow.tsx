import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  onDark?: boolean;
}

export function Eyebrow({ onDark = false, className, ...rest }: EyebrowProps) {
  return (
    <span
      className={cn(
        "type-label inline-flex items-center gap-2 before:size-1.5 before:rounded-full before:bg-current before:content-['']",
        onDark ? "text-dark-accent" : "text-accent",
        className,
      )}
      {...rest}
    />
  );
}
