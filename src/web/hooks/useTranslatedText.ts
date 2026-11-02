import { useQuery } from "@tanstack/react-query";
import { sarvam } from "@core/api/sarvam";
import type { LanguageCode } from "@core/i18n/languages";

export function useTranslatedText(text: string, language: LanguageCode): string {
  const query = useQuery({
    queryKey: ["translate", language, text],
    enabled: language !== "en" && text.length > 0,
    queryFn: () => sarvam.translate(text, language, "en"),
    staleTime: Infinity,
    retry: 0,
  });
  return language === "en" ? text : (query.data?.text ?? text);
}
