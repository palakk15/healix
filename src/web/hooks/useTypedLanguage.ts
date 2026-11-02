import { useEffect, useRef, useState } from "react";
import { detectLanguage, languagesMatch } from "@core/domain/languageDetect";
import type { LanguageCode } from "@core/i18n/languages";
import { getVoiceMode } from "../lib/voiceMode";

export interface TypedLanguageOptions {
  hint?: LanguageCode | null;
  minLength?: number;
  debounceMs?: number;
}

export function useTypedLanguage(text: string, uiLanguage: LanguageCode, options: TypedLanguageOptions = {}) {
  const { hint = null, minLength = 8, debounceMs = 600 } = options;
  const [detected, setDetected] = useState<LanguageCode | null>(null);
  const dismissed = useRef<Set<LanguageCode>>(new Set());
  const [, bump] = useState(0);

  useEffect(() => {
    if (hint) {
      setDetected(hint);
      return undefined;
    }
    const trimmed = text.trim();
    if (trimmed.length < minLength) {
      setDetected(null);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(() => {
      const local = detectLanguage(trimmed);
      setDetected(local);
      void getVoiceMode().then(async (mode) => {
        if (mode !== "live" || !active) return;
        try {
          const { sarvam } = await import("@core/api/sarvam");
          const result = await sarvam.identify(trimmed);
          if (active) setDetected(result.language);
        } catch {
          return;
        }
      });
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [debounceMs, hint, minLength, text]);

  const suggested = detected && !languagesMatch(detected, uiLanguage) && !dismissed.current.has(detected) ? detected : null;

  return {
    suggested,
    dismiss: () => {
      if (detected) dismissed.current.add(detected);
      bump((value) => value + 1);
    },
  };
}
