import { layoutSegments, valuePercent, type RangeSegment, type RangeTone } from "@core/domain/rangeBar";
import { cn } from "../../lib/cn";

const toneClass: Record<RangeTone, string> = {
  ok: "bg-ok",
  watch: "bg-watch",
  out: "bg-out",
};

export interface RangeBarProps {
  segments: readonly RangeSegment[];
  value: number;
  min: number;
  max: number;
  label?: string;
  className?: string;
}

export function RangeBar({ segments, value, min, max, label, className }: RangeBarProps) {
  const layout = layoutSegments(segments, min, max);
  const percent = valuePercent(value, min, max);
  const lastIndex = layout.length - 1;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative flex h-1.5 gap-0.5", className)}
    >
      {layout.map((segment, index) => (
        <i
          key={`${segment.tone}-${index}`}
          className={cn(
            "block h-full",
            toneClass[segment.tone],
            index === 0 && "rounded-l-[3px]",
            index === lastIndex && "rounded-r-[3px]",
          )}
          style={{ flex: `${segment.share} 1 0%` }}
        />
      ))}
      <span
        className="absolute -top-[5px] box-border size-4 rounded-full border-[3px] border-surface bg-ink"
        style={{ left: `clamp(0px, calc(${percent}% - 8px), calc(100% - 16px))` }}
      />
    </div>
  );
}
