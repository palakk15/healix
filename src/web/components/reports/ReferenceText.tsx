import { useTranslation } from "react-i18next";
import type { Observation } from "@core/api/schemas/ai";

export function ReferenceText({ observation }: { observation: Pick<Observation, "reference" | "unit"> }) {
  const { t } = useTranslation();
  const { low, high } = observation.reference;
  const unit = observation.unit;
  if (low !== null && low > 0 && high !== null) return <>{t("reports.reference.range", { low, high, unit })}</>;
  if (high !== null) return <>{t("reports.reference.upTo", { high, unit })}</>;
  if (low !== null) return <>{t("reports.reference.atLeast", { low, unit })}</>;
  return null;
}
