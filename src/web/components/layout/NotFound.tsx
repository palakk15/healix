import { useTranslation } from "react-i18next";
import { Button } from "../base/Button";
import { Card } from "../base/Card";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <main id="main" className="px-5 py-24">
      <Card className="mx-auto max-w-[560px] text-center">
        <h1 className="type-h2">{t("errors.notFoundTitle")}</h1>
        <p className="type-body mt-4">{t("errors.notFoundBody")}</p>
        <Button to="/" className="mt-8">{t("errors.goHome")}</Button>
      </Card>
    </main>
  );
}

export function RouteError() {
  const { t } = useTranslation();
  return (
    <main id="main" className="px-5 py-24">
      <Card className="mx-auto max-w-[560px] text-center">
        <h1 className="type-h2">{t("errors.generic")}</h1>
        <Button to="/" className="mt-8">{t("errors.goHome")}</Button>
      </Card>
    </main>
  );
}
