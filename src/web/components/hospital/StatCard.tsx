import type { ReactNode } from "react";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  estimate?: string;
  testId?: string;
}

export function StatCard({ label, value, hint, estimate, testId }: StatCardProps) {
  return (
    <Card as="section" aria-label={label} className="flex flex-col gap-2 !p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="type-label">{label}</p>
        {estimate ? <Chip tone="outline">{estimate}</Chip> : null}
      </div>
      <p data-testid={testId} className="type-stat">{value}</p>
      {hint ? <p className="type-small">{hint}</p> : null}
    </Card>
  );
}
