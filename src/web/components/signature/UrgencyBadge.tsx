import { CalendarClock, CircleCheck, Clock, Siren, type LucideIcon } from "lucide-react";
import type { Urgency } from "@core/domain/specialty";
import { urgencyLabel } from "@core/domain/labels";
import { cn } from "../../lib/cn";
import { usePreferences } from "../../store";

const visuals: Record<Urgency, { Icon: LucideIcon; className: string }> = {
  emergency: { Icon: Siren, className: "border border-emergency-border bg-emergency-fill text-emergency-text" },
  urgent: { Icon: Clock, className: "bg-watch-tint text-watch-text" },
  soon: { Icon: CalendarClock, className: "bg-accent-soft text-accent-soft-text" },
  routine: { Icon: CircleCheck, className: "border border-line bg-surface text-ink-2" },
};

export function UrgencyBadge({ urgency, className }: { urgency: Urgency; className?: string }) {
  const language = usePreferences((state) => state.language);
  const { Icon, className: tone } = visuals[urgency];
  return (
    <span data-urgency={urgency} className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-[13px] font-medium leading-none", tone, className)}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      {urgencyLabel(urgency, language)}
    </span>
  );
}
