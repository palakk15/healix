import { useTranslation } from "react-i18next";
import { Logo } from "../base/Logo";
import { Container } from "../layout/Container";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <Container as="footer" className="mt-24 flex items-center border-t border-line pb-16 pt-12">
      <Logo size={28} name={t("brand.name")} />
    </Container>
  );
}
