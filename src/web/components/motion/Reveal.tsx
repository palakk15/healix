import { useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type Ref } from "react";
import { motionTokens } from "@core/tokens";

export type RevealTag = "div" | "section" | "li" | "p" | "span";

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  index?: number;
  as?: RevealTag;
}

export function Reveal({ index = 0, as = "div", className, style, children, ...rest }: RevealProps) {
  const Tag = as as ElementType<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>;
  const element = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = element.current;
    if (!node || revealed) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: motionTokens.revealThreshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  const delay = { "--reveal-delay": `${index * motionTokens.revealStaggerMs}ms` } as CSSProperties;

  return (
    <Tag
      ref={element}
      data-revealed={revealed}
      className={className ? `reveal ${className}` : "reveal"}
      style={{ ...delay, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
