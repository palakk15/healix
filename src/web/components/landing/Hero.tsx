import { useRef, useState, type FormEvent } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { LanguageCode } from "@core/i18n/languages";
import { Button } from "../base/Button";
import { Container } from "../layout/Container";
import { Reveal } from "../motion/Reveal";
import { LanguageSwitchPrompt } from "../signature/LanguageSwitchPrompt";
import { VoiceButton, type VoiceResult } from "../signature/VoiceButton";
import { usePreferences } from "../../store";

export function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const language = usePreferences((state) => state.language);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [spokenLanguage, setSpokenLanguage] = useState<LanguageCode | null>(null);

  function receiveTranscript(result: VoiceResult) {
    setText(result.text);
    setHeard(result.text);
    setSpokenLanguage(result.language);
    inputRef.current?.focus();
  }

  function editText(value: string) {
    setText(value);
    setHeard(null);
    setSpokenLanguage(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const query = text.trim();
    navigate(query ? `/app/triage?q=${encodeURIComponent(query)}` : "/app/triage");
  }

  return (
    <Container as="section" className="pb-8 pt-16 text-center md:pt-28">
      <Reveal>
        <h1 className="type-display-xl">
          <Trans i18nKey="landing.hero.title" components={{ br: <br />, i: <i /> }} />
        </h1>
        <p className="type-lead lead-balance mx-auto mt-8 max-w-[720px] text-ink-2">{t("landing.hero.lead")}</p>
      </Reveal>

      <Reveal index={1}>
        <form
          onSubmit={submit}
          className="mx-auto mt-12 flex h-16 w-full max-w-[640px] items-center gap-3 rounded-pill border border-line bg-surface pl-7 pr-2 shadow-input focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => editText(event.target.value)}
            aria-label={t("landing.hero.inputLabel")}
            placeholder={t("landing.hero.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-left text-[16px] text-ink outline-none placeholder:text-ink-3-text"
          />
          <VoiceButton language={language} purpose="symptoms" label={t("landing.hero.mic")} onResult={receiveTranscript} onMessage={setVoiceMessage} />
          <button
            type="submit"
            aria-label={t("landing.hero.submit")}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent/90"
          >
            <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </form>
        <div aria-live="polite" className="type-small mx-auto mt-3 empty:hidden">
          {voiceMessage ?? (heard ? t("voice.heardAs", { text: heard }) : null)}
        </div>
        <LanguageSwitchPrompt text={text} hint={spokenLanguage} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/app/welcome">{t("landing.hero.tryDemo")}</Button>
          <Button href="#how-it-works" variant="secondary">
            {t("landing.hero.seeHow")}
          </Button>
        </div>
      </Reveal>
    </Container>
  );
}
