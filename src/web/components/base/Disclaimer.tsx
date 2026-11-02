import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";

export interface DisclaimerProps {
  text?: string;
  className?: string;
}

export function Disclaimer({ text, className }: DisclaimerProps) {
  const { t } = useTranslation();
  return (
    <p className={cn("type-small mt-4 border-t border-line pt-3 text-ink-3-text", className)}>
      {text && text.trim().length > 0 ? text : t("disclaimer.guidance")}
    </p>
  );
}
