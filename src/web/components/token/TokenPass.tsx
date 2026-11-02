import { Hospital, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { RollingNumber } from "../motion/RollingNumber";

export interface TokenPassProps {
  label: string;
  doctorName: string;
  hospitalName: string;
  room: string;
  nowServing: string | null;
  ahead: number;
  status: "waiting" | "called" | "completed" | "cancelled";
  className?: string;
}

export function TokenPass({ label, doctorName, hospitalName, room, nowServing, ahead, status, className }: TokenPassProps) {
  const { t } = useTranslation();
  const statusKey = status === "waiting" ? (ahead === 0 ? "next" : "waiting") : status;
  return (
    <div className={cn("relative overflow-hidden rounded-panel bg-ink text-bg shadow-card", className)}>
      <div className="px-6 pb-6 pt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="type-label !text-bg/70">{t("tokenView.pass")}</span>
          <span className="inline-flex items-center gap-2 rounded-pill bg-bg/10 px-3 py-1 text-[13px] font-medium">
            <span aria-hidden="true" className={cn("size-2 rounded-full", status === "completed" || status === "cancelled" ? "bg-bg/50" : "animate-pulse bg-dark-accent motion-reduce:animate-none")} />
            {t(`tokenView.status.${statusKey}`)}
          </span>
        </div>
        <p data-testid="ticket-number" className="mt-4 font-serif text-[72px] leading-[72px] tracking-[-0.02em] text-bg">{label}</p>
        <p className="mt-4 text-[17px] font-medium text-bg">{doctorName}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-bg/75">
          <span className="inline-flex items-center gap-1.5"><Hospital size={15} strokeWidth={1.75} aria-hidden="true" />{hospitalName}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={15} strokeWidth={1.75} aria-hidden="true" />{room}</span>
        </p>
      </div>
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-x-5 top-1/2 border-t border-dashed border-bg/30" />
        <span aria-hidden="true" className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-bg" />
        <span aria-hidden="true" className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-bg" />
        <div className="h-6" />
      </div>
      <div aria-live="polite" className="flex items-end justify-between gap-4 px-6 pb-6 pt-3">
        <div>
          <span className="type-label !text-bg/70">{t("ticket.nowServing")}</span>
          <p className="mt-1 font-mono text-[28px] leading-[32px] text-bg">{nowServing ? <RollingNumber value={nowServing} /> : "–"}</p>
        </div>
        <p className="text-right text-[15px] font-medium text-bg">{ahead === 0 ? t("ticket.yourTurn") : t("ticket.ahead", { number: ahead })}</p>
      </div>
    </div>
  );
}
