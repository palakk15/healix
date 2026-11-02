import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { screenKeyFor } from "@core/domain/pageTitle";

export function usePageTitle(): void {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const key = screenKeyFor(pathname);
  const title = key ? t(`screens.${key}`) : null;
  const language = i18n.language;

  useEffect(() => {
    document.title = title ? `${title} · Healix` : "Healix";
  }, [title, language]);
}
