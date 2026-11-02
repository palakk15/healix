import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { RollingNumber } from "../motion/RollingNumber";

export interface TokenTicketProps {
  label: string;
  nowServing: string | null;
  ahead: number;
  doctorLine: string;
  className?: string;
}

export function TokenTicket({ label, nowServing, ahead, doctorLine, className }: TokenTicketProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("relative overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
      <div className="px-6 pb-6 pt-5">
        <span className="type-label">{t("ticket.yourToken")}</span>
        <p className="type-stat mt-1 text-ink" data-testid="ticket-number">
          {label}
        </p>
        <p className="type-small mt-1">{doctorLine}</p>
      </div>
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-x-5 top-1/2 border-t border-dashed border-line" />
        <span aria-hidden="true" className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full border border-line bg-bg" />
        <span aria-hidden="true" className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full border border-line bg-bg" />
        <div className="h-5" />
      </div>
      <div aria-live="polite" className="flex items-end justify-between gap-4 px-6 pb-5 pt-3">
        <div>
          <span className="type-label">{t("ticket.nowServing")}</span>
          <p className="type-data mt-0.5 text-ink">{nowServing ? <RollingNumber value={nowServing} /> : "–"}</p>
        </div>
        <p className="type-small text-right">{ahead === 0 ? t("ticket.yourTurn") : t("ticket.ahead", { number: ahead })}</p>
      </div>
    </div>
  );
}
