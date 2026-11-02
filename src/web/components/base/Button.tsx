import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

export const buttonStyles = cva(
  "type-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill select-none",
  {
    variants: {
      variant: {
        primary: "bg-ink text-bg hover:bg-ink/90",
        secondary: "border border-line bg-surface text-ink hover:border-ink-3",
        accent: "bg-accent text-surface hover:bg-accent/90",
        ghost: "text-ink-2 hover:text-ink",
      },
      size: {
        md: "h-12 px-6",
        sm: "h-10 px-[18px] text-[14px] max-md:h-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type StyleProps = VariantProps<typeof buttonStyles> & { children?: ReactNode; className?: string };

type ButtonAsButton = StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined; href?: undefined };
type ButtonAsRoute = StyleProps & Omit<LinkProps, "className" | "children"> & { href?: undefined };
type ButtonAsAnchor = StyleProps & AnchorHTMLAttributes<HTMLAnchorElement> & { to?: undefined; href: string };

export type ButtonProps = ButtonAsButton | ButtonAsRoute | ButtonAsAnchor;

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(props, ref) {
  const { variant, size, className, children, ...rest } = props;
  const classes = cn(buttonStyles({ variant, size }), className);

  if ("to" in rest && rest.to !== undefined) {
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...(rest as Omit<LinkProps, "className">)}>
        {children}
      </Link>
    );
  }

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type={buttonRest.type ?? "button"} className={classes} {...buttonRest}>
      {children}
    </button>
  );
});
