import { useTranslation } from "react-i18next";

export function PageFallback() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="type-small px-5 py-16 text-center text-ink-3-text">
      {t("common.loading")}
    </div>
  );
}
