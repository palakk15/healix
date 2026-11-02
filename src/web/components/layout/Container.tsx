import type { ElementType, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Container({ as: Component = "div", className, ...rest }: HTMLAttributes<HTMLElement> & { as?: ElementType }) {
  return <Component className={cn("mx-auto w-full max-w-[1264px] px-5 md:px-8", className)} {...rest} />;
}
