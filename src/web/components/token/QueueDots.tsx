import { useTranslation } from "react-i18next";

const maxDots = 12;

export function QueueDots({ ahead }: { ahead: number }) {
  const { t } = useTranslation();
  const shown = Math.min(ahead, maxDots);
  return (
    <div data-testid="queue-dots" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: shown }, (_, index) => (
          <span key={index} className="size-4 rounded-full bg-line" />
        ))}
        {ahead > maxDots ? <span className="type-small ml-1">+{ahead - maxDots}</span> : null}
        <span className="ml-1 inline-flex h-6 items-center rounded-pill bg-accent px-3 text-[12px] font-medium text-white">{t("tokenView.you")}</span>
      </div>
      <p className="type-small">{ahead === 0 ? t("ticket.yourTurn") : t("ticket.ahead", { number: ahead })}</p>
    </div>
  );
}
