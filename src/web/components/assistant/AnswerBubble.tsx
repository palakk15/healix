import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Citation } from "@core/api/schemas/ai";
import type { AssistantMessage } from "@core/domain/assistantChat";
import { stripCitations } from "@core/domain/citations";
import type { LanguageCode } from "@core/i18n/languages";
import { useVoiceMode } from "../../lib/voiceMode";
import { usePreferences } from "../../store";
import { Button } from "../base/Button";
import { Disclaimer } from "../base/Disclaimer";
import { ListenButton } from "../signature/ListenButton";
import { CitedText } from "./CitedText";

export interface AnswerBubbleProps {
  message: AssistantMessage;
  language: LanguageCode;
  onOpenSource: (citation: Citation) => void;
  onRetry: () => void;
}

export function AnswerBubble({ message, language, onOpenSource, onRetry }: AnswerBubbleProps) {
  const { t } = useTranslation();
  const voice = useVoiceMode();
  const elderMode = usePreferences((state) => state.elderMode);
  const [devanagari, setDevanagari] = useState(false);
  const answerLanguage = (message.language as LanguageCode | undefined) ?? language;
  const plain = stripCitations(message.text);
  const canToggle = voice === "live" && answerLanguage === "hinglish" && message.status === "done" && plain.length > 0;

  const converted = useQuery({
    queryKey: ["transliterate", plain],
    enabled: devanagari && canToggle,
    queryFn: async () => {
      const { sarvam } = await import("@core/api/sarvam");
      return sarvam.transliterate(plain, "hinglish", "hi");
    },
    staleTime: Infinity,
    retry: 0,
  });

  if (message.status === "refused" && message.refusal) {
    return (
      <div role="note" data-testid="refusal" data-reason={message.refusal.reason} className="rounded-card border border-line bg-stage p-5">
        <p className="type-body">{message.refusal.message}</p>
      </div>
    );
  }

  if (message.status === "failed") {
    return (
      <div role="alert" className="rounded-card border border-line bg-surface p-5">
        <p className="type-body">{t("assistant.failed")}</p>
        <Button onClick={onRetry} variant="secondary" size="sm" className="mt-4">
          {t("assistant.retry")}
        </Button>
      </div>
    );
  }

  const shown = devanagari && converted.data ? converted.data.text : message.text;

  return (
    <div data-testid="answer" className="rounded-card border border-line bg-surface p-5 shadow-card">
      {message.text.length === 0 ? (
        <p className="type-body text-ink-3-text">{t("assistant.thinking")}</p>
      ) : devanagari && converted.data ? (
        <p className="type-body font-[Mukta]">{shown}</p>
      ) : (
        <CitedText text={message.text} citations={message.citations} onOpen={onOpenSource} />
      )}
      {message.status === "done" && plain.length > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ListenButton text={plain} language={answerLanguage} autoPlay={elderMode} />
            {canToggle ? (
              <button
                type="button"
                aria-pressed={devanagari}
                onClick={() => setDevanagari((value) => !value)}
                className="type-small inline-flex min-h-11 items-center rounded-pill border border-line px-4 font-medium text-ink hover:border-ink-3"
              >
                {t("assistant.devanagari")}
              </button>
            ) : null}
          </div>
          {message.model && !message.model.startsWith("report-") ? <p data-testid="answer-source" className="type-small mt-3">{t("assistant.viaGroq")}</p> : null}
          <Disclaimer text={message.disclaimer} />
        </>
      ) : null}
    </div>
  );
}
