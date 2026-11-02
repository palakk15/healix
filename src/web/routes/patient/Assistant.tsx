import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Citation } from "@core/api/schemas/ai";
import { AnswerBubble } from "../../components/assistant/AnswerBubble";
import { SourceSheet } from "../../components/assistant/SourceSheet";
import { VoiceButton, type VoiceResult } from "../../components/signature/VoiceButton";
import { useAssistantChat } from "../../hooks/useAssistantChat";
import { usePreferences } from "../../store";

const starters = ["hba1c", "range", "summary"] as const;

export default function Assistant() {
  const { t } = useTranslation();
  const language = usePreferences((state) => state.language);
  const chat = useAssistantChat(language);
  const [text, setText] = useState("");
  const [source, setSource] = useState<Citation | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastQuestion = useRef("");

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [chat.messages]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const question = text.trim();
    if (!question || chat.busy) return;
    lastQuestion.current = question;
    setText("");
    setVoiceMessage(null);
    void chat.ask(question);
  }

  function receive(result: VoiceResult) {
    setText(result.text);
  }

  return (
    <main id="main" className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4 px-5 pb-6 pt-8">
      <h1 className="type-h2">{t("assistant.title")}</h1>
      <p className="type-small">{t("assistant.intro")}</p>

      <div role="log" aria-live="polite" aria-label={t("assistant.conversation")} className="flex flex-1 flex-col gap-4">
        {chat.messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="type-label">{t("assistant.try")}</p>
            <ul className="flex flex-col gap-2">
              {starters.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      lastQuestion.current = t(`assistant.starters.${key}`);
                      void chat.ask(t(`assistant.starters.${key}`));
                    }}
                    className="type-body min-h-11 w-full rounded-card border border-line bg-surface px-4 py-3 text-left hover:border-ink-3"
                  >
                    {t(`assistant.starters.${key}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {chat.messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} data-testid="question" className="type-body ml-auto max-w-[85%] rounded-card bg-ink px-4 py-3 !text-bg">
              {message.text}
            </div>
          ) : (
            <AnswerBubble
              key={message.id}
              message={message}
              language={language}
              onOpenSource={setSource}
              onRetry={() => void chat.ask(lastQuestion.current)}
            />
          ),
        )}
        <div ref={end} />
      </div>

      <form onSubmit={submit} className="sticky bottom-20 flex flex-col gap-2 bg-bg pt-2">
        <div aria-live="polite" className="type-small empty:hidden">
          {voiceMessage}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            {t("assistant.inputLabel")}
          </label>
          <input
            id="assistant-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("assistant.placeholder")}
            autoComplete="off"
            className="type-body h-12 min-w-0 flex-1 rounded-pill border border-line bg-white px-5"
          />
          <VoiceButton language={language} purpose="assistant" label={t("voice.speakQuestion")} onResult={receive} onMessage={setVoiceMessage} />
          {chat.busy ? (
            <button type="button" onClick={chat.stop} aria-label={t("assistant.stop")} className="inline-flex h-12 w-12 items-center justify-center rounded-pill border border-line bg-surface">
              <Square size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" disabled={text.trim().length === 0} aria-label={t("assistant.send")} className="inline-flex h-12 w-12 items-center justify-center rounded-pill bg-ink text-bg disabled:opacity-40">
              <Send size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>

      <SourceSheet citation={source} onClose={() => setSource(null)} />
    </main>
  );
}
