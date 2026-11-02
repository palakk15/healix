import { Ticket, FileText, House, Sparkles, Stethoscope, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

interface TabItem {
  to: string;
  labelKey: string;
  Icon: LucideIcon;
  end?: boolean;
}

const tabs: TabItem[] = [
  { to: "/app", labelKey: "tabs.home", Icon: House, end: true },
  { to: "/app/triage", labelKey: "tabs.symptoms", Icon: Stethoscope },
  { to: "/app/reports", labelKey: "tabs.reports", Icon: FileText },
  { to: "/app/token/current", labelKey: "tabs.token", Icon: Ticket },
  { to: "/app/assistant", labelKey: "tabs.assistant", Icon: Sparkles },
];

export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.primary")}
      className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-bg"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, labelKey, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "touch-target flex flex-col items-center justify-center gap-1 py-2 text-[12px] leading-4",
                  isActive ? "text-accent" : "text-ink-3-text hover:text-ink",
                )
              }
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
