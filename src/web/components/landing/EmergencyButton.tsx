import { Siren } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export function EmergencyButton({ className, onClick }: { className?: string; onClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/emergency"
      onClick={onClick}
      aria-label={t("landing.nav.emergencyLabel")}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-pill border border-emergency-border bg-emergency-fill px-4 text-[15px] font-medium text-emergency-text hover:brightness-95",
        className,
      )}
    >
      <Siren size={18} strokeWidth={1.75} aria-hidden="true" />
      {t("nav.emergency")}
    </Link>
  );
}
