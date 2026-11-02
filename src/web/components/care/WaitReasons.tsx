import { useTranslation } from "react-i18next";
import type { PredictedWait } from "@core/api/schemas/backend";
import { formatSignedMinutes } from "@core/domain/format";
import { cn } from "../../lib/cn";
import { Card } from "../base/Card";
import { Chip } from "../base/Chip";

export function WaitReasons({ prediction }: { prediction: PredictedWait }) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-h3">{t("token.whyTitle")}</h2>
        <Chip tone="outline">{t("token.estimate")}</Chip>
      </div>
      <ul className="flex flex-col">
        {prediction.reasons.map((reason) => (
          <li key={reason.code} className="type-small flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
            <span>{t(`reasons.${reason.code}`, { defaultValue: reason.label })}</span>
            <span className={cn("type-data", reason.minutes > 0 ? "text-alert-text" : "text-accent")}>{formatSignedMinutes(reason.minutes)}</span>
          </li>
        ))}
      </ul>
      <p className="type-body font-medium text-ink">
        {t("token.yourWait")}: <span className="type-data">~{prediction.wait_minutes} min</span>
      </p>
      <p className="type-small">{t("token.between", { low: prediction.range_low, high: prediction.range_high })}</p>
    </Card>
  );
}
