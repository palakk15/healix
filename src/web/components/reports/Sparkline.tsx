interface SparklineProps {
  points: ReadonlyArray<{ date: string; value: number }>;
  label: string;
}

const width = 120;
const height = 32;
const pad = 4;

export function Sparkline({ points, label }: SparklineProps) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const coords = points.map((point, index) => ({
    x: pad + (index / (points.length - 1)) * (width - pad * 2),
    y: height - pad - ((point.value - low) / span) * (height - pad * 2),
  }));
  const last = coords[coords.length - 1];
  return (
    <svg role="img" aria-label={label} data-testid="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline points={coords.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-3-text" />
      {last ? <circle cx={last.x} cy={last.y} r="3.5" className="fill-ink stroke-surface" strokeWidth="2" /> : null}
    </svg>
  );
}
