import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";
import { waitChange } from "@core/domain/delayAlert";

export function DelayBanner({ initialMinutes, currentMinutes }: { initialMinutes: number; currentMinutes: number }) {
  const { t } = useTranslation();
  const change = waitChange(initialMinutes, currentMinutes);
  if (!change.alert) return null;
  const minutes = Math.abs(change.deltaMinutes);

  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-line bg-watch-tint px-5 py-4">
      <Hourglass size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-watch-text" aria-hidden="true" />
      <div>
        <p className="type-h3 !text-watch-text">{t("token.delayTitle")}</p>
        <p className="type-small !text-watch-text">{change.deltaMinutes > 0 ? t("token.delayLonger", { minutes }) : t("token.delayShorter", { minutes })}</p>
      </div>
    </div>
  );
}
