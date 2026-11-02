import { useEffect, useState } from "react";
import { motionTokens } from "@core/tokens";

export interface RollingNumberProps {
  value: string | number;
  className?: string;
}

export function RollingNumber({ value, className }: RollingNumberProps) {
  const text = String(value);
  const [shown, setShown] = useState(text);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (text === shown) return;
    setLeaving(shown);
    setShown(text);
  }, [shown, text]);

  useEffect(() => {
    if (leaving === null) return undefined;
    const timer = setTimeout(() => setLeaving(null), motionTokens.numberRollMs);
    return () => clearTimeout(timer);
  }, [leaving]);

  return (
    <span className={`roll relative inline-flex overflow-hidden align-bottom ${className ?? ""}`}>
      {leaving !== null ? (
        <span aria-hidden="true" className="roll-out absolute left-0 top-0 inline-block">
          {leaving}
        </span>
      ) : null}
      <span key={shown} className={leaving !== null ? "roll-in inline-block" : "inline-block"}>
        {shown}
      </span>
    </span>
  );
}
