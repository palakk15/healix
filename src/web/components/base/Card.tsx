import type { ElementType, HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const cardStyles = cva("rounded-card border border-line shadow-card", {
  variants: {
    tint: { surface: "bg-surface", stage: "bg-stage" },
    padding: { none: "", md: "p-6 md:p-8" },
  },
  defaultVariants: { tint: "surface", padding: "md" },
});

export type CardProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof cardStyles> & { as?: ElementType };

export function Card({ as: Component = "div", tint, padding, className, ...rest }: CardProps) {
  return <Component className={cn(cardStyles({ tint, padding }), className)} {...rest} />;
}
