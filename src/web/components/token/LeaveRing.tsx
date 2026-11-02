import { useTranslation } from "react-i18next";
import { RollingNumber } from "../motion/RollingNumber";

export interface LeaveRingProps {
  minutesLeft: number;
  totalMinutes: number;
}

const radius = 62;
const circumference = 2 * Math.PI * radius;

export function LeaveRing({ minutesLeft, totalMinutes }: LeaveRingProps) {
  const { t } = useTranslation();
  const progress = totalMinutes <= 0 ? 1 : Math.min(Math.max(1 - minutesLeft / totalMinutes, 0), 1);
  return (
    <div className="relative size-[168px] shrink-0" role="img" aria-label={t("tokenView.ringLabel", { minutes: minutesLeft })}>
      <svg viewBox="0 0 150 150" aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx="75" cy="75" r={radius} fill="none" strokeWidth="9" className="stroke-line" />
        <circle
          cx="75"
          cy="75"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="stroke-accent transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="type-label">{t("token.leaveIn")}</span>
        <span className="font-serif text-[44px] leading-[48px] text-ink">
          <RollingNumber value={minutesLeft} />
        </span>
        <span className="type-small">{t("token.minutesUnit")}</span>
      </div>
    </div>
  );
}
