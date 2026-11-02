import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LanguageCode } from "@core/i18n/languages";
import { cacheKey, readCachedAudio, writeCachedAudio } from "../../audio/audioCache";
import { playAudios, stopAllPlayback, type PlaybackHandle } from "../../audio/player";
import { cn } from "../../lib/cn";
import { grantVoiceConsent, useVoiceConsent } from "../../lib/voiceConsent";
import { useVoiceMode } from "../../lib/voiceMode";
import { usePreferences } from "../../store";
import { ConsentNotice } from "./ConsentNotice";

export type ListenState = "idle" | "notice" | "loading" | "playing";

export interface ListenDeps {
  speak: (text: string, language: LanguageCode, pace: number) => Promise<string[]>;
  play: (audios: string[]) => PlaybackHandle;
}

export interface ListenButtonProps {
  text: string;
  language: LanguageCode;
  className?: string;
  label?: string;
  autoPlay?: boolean;
  deps?: Partial<ListenDeps>;
}

const normalPace = 1;
const elderPace = 0.85;

const defaultSpeak: ListenDeps["speak"] = async (text, language, pace) => {
  const { sarvam } = await import("@core/api/sarvam");
  const result = await sarvam.speak(text, language, pace === normalPace ? undefined : pace);
  return result.audios;
};

export function ListenButton({ text, language, className, label, autoPlay = false, deps }: ListenButtonProps) {
  const { t } = useTranslation();
  const mode = useVoiceMode();
  const consented = useVoiceConsent();
  const elderMode = usePreferences((state) => state.elderMode);
  const [state, setState] = useState<ListenState>("idle");
  const [failed, setFailed] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);
  const speak = deps?.speak ?? defaultSpeak;
  const play = deps?.play ?? playAudios;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      handle.current?.stop();
    };
  }, []);

  const start = useCallback(async () => {
    setFailed(false);
    setState("loading");
    try {
      const pace = elderMode ? elderPace : normalPace;
      const key = await cacheKey(text, language, pace);
      let audios = await readCachedAudio(key);
      if (!audios) {
        audios = await speak(text, language, pace);
        void writeCachedAudio(key, audios);
      }
      if (!mounted.current) return;
      handle.current = play(audios);
      setState("playing");
      await handle.current.finished;
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      handle.current = null;
      if (mounted.current) setState("idle");
    }
  }, [elderMode, language, play, speak, text]);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoPlay || autoStarted.current || mode !== "live" || !consented) return;
    autoStarted.current = true;
    void start();
  }, [autoPlay, consented, mode, start]);

  if (mode !== "live") return null;

  const onClick = () => {
    if (state === "playing" || state === "loading") {
      handle.current?.stop();
      stopAllPlayback();
      setState("idle");
    } else if (state === "idle") {
      if (consented) void start();
      else setState("notice");
    }
  };

  const active = state === "playing" || state === "loading";

  return (
    <ConsentNotice
      open={state === "notice"}
      noticeKey="voice.noticeListen"
      align="left"
      onAllow={() => {
        grantVoiceConsent();
        void start();
      }}
      onCancel={() => setState("idle")}
    >
      <span className="inline-flex flex-col items-start">
        <button
          type="button"
          onClick={onClick}
          aria-label={active ? t("voice.stopListening") : (label ?? t("voice.listen"))}
          aria-pressed={state === "playing"}
          className={cn(
            "type-small inline-flex min-h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 font-medium text-ink hover:border-ink-3",
            state === "playing" && "border-accent text-accent",
            className,
          )}
        >
          {state === "loading" ? (
            <Loader2 size={16} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
          ) : state === "playing" ? (
            <Square size={16} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
          ) : (
            <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span>{active ? t("voice.stopListening") : (label ?? t("voice.listen"))}</span>
        </button>
        {failed ? (
          <span role="status" className="type-small mt-1 text-alert-text">
            {t("voice.listenFailed")}
          </span>
        ) : null}
        <span role="status" className="sr-only">
          {state === "loading" ? t("voice.loadingAudio") : ""}
        </span>
      </span>
    </ConsentNotice>
  );
}
