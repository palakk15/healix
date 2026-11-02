import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { layout } from "@core/tokens";
import { useScrolled } from "../../hooks/useScrolled";
import { cn } from "../../lib/cn";
import { Button } from "../base/Button";
import { LanguageSelect } from "../base/LanguageSelect";
import { Logo } from "../base/Logo";
import { Container } from "../layout/Container";
import { EmergencyButton } from "./EmergencyButton";
import { MobileMenu } from "./MobileMenu";

const links = [
  { href: "#how-it-works", labelKey: "nav.howItWorks" },
  { href: "#features", labelKey: "nav.features" },
  { href: "#for-hospitals", labelKey: "nav.forHospitals" },
];

export function SiteNav() {
  const { t } = useTranslation();
  const scrolled = useScrolled(40);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[height,background-color,backdrop-filter] duration-200 ease-calm",
        scrolled ? "bg-[rgba(244,242,236,.88)] backdrop-blur-[8px]" : "bg-transparent",
      )}
      style={{ height: scrolled ? layout.stickyNavHeight : layout.navHeight }}
    >
      <Container className="flex h-full items-center justify-between gap-4">
        <Link to="/" aria-label={t("landing.nav.home")} className="rounded-small">
          <Logo name={t("brand.name")} size={38} className="max-md:hidden" />
          <Logo name={t("brand.name")} size={32} className="md:hidden" />
        </Link>
        <nav aria-label={t("nav.primary")} className="hidden lg:block">
          <ul className="flex gap-10 text-[17px] text-ink-2">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-ink">
                  {t(link.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3">
          <EmergencyButton />
          <LanguageSelect className="max-md:hidden" />
          <Button to="/app/welcome" variant="secondary" size="sm" className="max-md:hidden">
            {t("nav.signIn")}
          </Button>
          <MobileMenu links={links} />
        </div>
      </Container>
    </header>
  );
}
