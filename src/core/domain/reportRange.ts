import type { RangeSegment } from "./rangeBar";

export interface ReferenceRange {
  low: number | null;
  high: number | null;
}

export interface BuiltRangeBar {
  segments: RangeSegment[];
  min: number;
  max: number;
}

const watchFraction = 0.15;
const outerFraction = 0.6;
const valueMargin = 0.1;

export function buildRangeBar(reference: ReferenceRange, value: number): BuiltRangeBar {
  const hasLow = reference.low !== null && reference.low > 0;
  const hasHigh = reference.high !== null;
  const low = hasLow ? (reference.low as number) : 0;
  const high = hasHigh ? (reference.high as number) : low * 2 || value * 1.5 || 1;
  const span = Math.max(high - low, 1e-6);
  const watch = span * watchFraction;

  let min = hasLow ? Math.max(low - span * outerFraction, 0) : 0;
  let max = hasHigh ? high + span * outerFraction : value * 1.5;
  const padding = Math.max(max - min, 1e-6) * valueMargin;
  min = Math.min(min, Math.max(value - padding, 0));
  max = Math.max(max, value + padding);

  const segments: RangeSegment[] = [];
  if (hasLow) {
    segments.push({ to: Math.max(low - watch, min), tone: "out" });
    segments.push({ to: low, tone: "watch" });
  }
  segments.push({ to: high, tone: "ok" });
  if (hasHigh) {
    segments.push({ to: Math.min(high + watch, max), tone: "watch" });
    segments.push({ to: max, tone: "out" });
  } else {
    segments.push({ to: max, tone: "ok" });
  }

  return { segments: segments.filter((segment, index) => index === 0 || segment.to > (segments[index - 1]?.to ?? 0)), min, max };
}
