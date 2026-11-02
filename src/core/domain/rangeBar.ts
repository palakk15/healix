export type RangeTone = "ok" | "watch" | "out";

export interface RangeSegment {
  to: number;
  tone: RangeTone;
}

export interface RangeLayoutSegment {
  tone: RangeTone;
  share: number;
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

export function layoutSegments(segments: readonly RangeSegment[], min: number, max: number): RangeLayoutSegment[] {
  const span = max - min;
  if (span <= 0) return [];
  let previous = min;
  return segments.map((segment) => {
    const end = clamp(segment.to, min, max);
    const share = Math.max(end - previous, 0) / span;
    previous = Math.max(previous, end);
    return { tone: segment.tone, share };
  });
}

export function valuePercent(value: number, min: number, max: number): number {
  const span = max - min;
  if (span <= 0) return 0;
  return clamp(((value - min) / span) * 100, 0, 100);
}
