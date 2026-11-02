import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const chipStyles = cva(
  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-[13px] font-medium leading-none",
  {
    variants: {
      tone: {
        soft: "bg-accent-soft text-accent-soft-text",
        watch: "bg-watch-tint text-watch-text",
        ink: "bg-ink text-bg",
        outline: "border border-line bg-surface/60 text-ink-2",
        emergency: "border border-emergency-border bg-emergency-fill text-emergency-text",
      },
    },
    defaultVariants: { tone: "soft" },
  },
);

export type ChipProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipStyles>;

export function Chip({ tone, className, ...rest }: ChipProps) {
  return <span className={cn(chipStyles({ tone }), className)} {...rest} />;
}
