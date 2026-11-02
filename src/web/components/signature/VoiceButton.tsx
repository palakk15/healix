import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SttResponse, SpeechPurpose } from "@core/api/schemas/sarvam";
import type { LanguageCode } from "@core/i18n/languages";
import { RecorderError } from "../../audio/recorderError";
import { maxRecordingMs, startRecordingOnDemand, type RecorderHandle, type Recording, type StartRecording } from "../../audio/recorderTypes";
import { cn } from "../../lib/cn";
import { grantVoiceConsent, useVoiceConsent } from "../../lib/voiceConsent";
import { markVoiceUnavailable, useVoiceMode } from "../../lib/voiceMode";
import { ConsentNotice } from "./ConsentNotice";

export type VoiceState = "idle" | "notice" | "recording" | "transcribing";

export interface VoiceResult {
  text: string;
  language: LanguageCode | null;
  source: SttResponse["source"];
}

export type Transcribe = (recording: Recording, options: { language: LanguageCode; purpose: SpeechPurpose }) => Promise<SttResponse>;

export interface VoiceButtonProps {
  language: LanguageCode;
  purpose: SpeechPurpose;
  onResult: (result: VoiceResult) => void;
  onMessage?: (message: string | null) => void;
  onStateChange?: (state: VoiceState) => void;
  size?: "md" | "lg";
  label?: string;
  className?: string;
  recorder?: StartRecording;
  transcribe?: Transcribe;
}

const defaultTranscribe: Transcribe = async (recording, options) => {
  const { sarvam } = await import("@core/api/sarvam");
  return sarvam.transcribe(recording.blob, { ...options, fileName: recording.fileName });
};

export function VoiceButton({
  language,
  purpose,
  onResult,
  onMessage,
  onStateChange,
  size = "md",
  label,
  className,
  recorder = startRecordingOnDemand,
  transcribe = defaultTranscribe,
}: VoiceButtonProps) {
  const { t } = useTranslation();
  const mode = useVoiceMode();
  const consented = useVoiceConsent();
  const [state, setStateValue] = useState<VoiceState>("idle");
  const [level, setLevel] = useState(0);
  const handle = useRef<RecorderHandle | null>(null);
  const busy = useRef(false);

  const setState = useCallback(
    (next: VoiceState) => {
      setStateValue(next);
      onStateChange?.(next);
    },
    [onStateChange],
  );

  const fail = useCallback(
    async (cause: unknown) => {
      let key = "voice.unavailable";
      if (cause instanceof RecorderError) key = cause.reason === "denied" ? "voice.denied" : cause.reason === "no_device" ? "voice.noDevice" : "voice.unavailable";
      else {
        const { ApiError } = await import("@core/api/error");
        if (cause instanceof ApiError) {
          if (cause.code === "no_speech" || cause.code === "no_audio") key = "voice.noSpeech";
          else if (cause.code === "rate_limited" || cause.code === "sarvam_rate_limited") key = "voice.busy";
          else if (cause.code === "sarvam_unavailable" || cause.code === "sarvam_not_configured") {
            markVoiceUnavailable();
            key = "voice.unavailable";
          }
        }
      }
      onMessage?.(t(key));
    },
    [onMessage, t],
  );

  const finish = useCallback(async () => {
    const active = handle.current;
    if (!active) return;
    handle.current = null;
    setLevel(0);
    setState("transcribing");
    onMessage?.(t("voice.transcribing"));
    try {
      const recording = await active.stop();
      const result = await transcribe(recording, { language, purpose });
      onMessage?.(null);
      onResult({ text: result.transcript, language: result.language, source: result.source });
    } catch (cause) {
      await fail(cause);
    } finally {
      busy.current = false;
      setState("idle");
    }
  }, [fail, language, onMessage, onResult, purpose, setState, t, transcribe]);

  const begin = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    onMessage?.(null);
    try {
      handle.current = await recorder({ maxMs: maxRecordingMs, onLevel: setLevel, onAutoStop: () => void finish() });
      setState("recording");
      onMessage?.(t("voice.listening"));
    } catch (cause) {
      busy.current = false;
      setState("idle");
      await fail(cause);
    }
  }, [fail, finish, onMessage, recorder, setState, t]);

  useEffect(() => {
    if (state !== "recording") return undefined;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      handle.current?.cancel();
      handle.current = null;
      busy.current = false;
      setLevel(0);
      setState("idle");
      onMessage?.(null);
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onMessage, setState, state]);

  useEffect(
    () => () => {
      handle.current?.cancel();
      handle.current = null;
    },
    [],
  );

  if (mode === "off") return null;

  const onClick = () => {
    if (state === "recording") void finish();
    else if (state === "idle") {
      if (consented) void begin();
      else setState("notice");
    }
  };

  const recording = state === "recording";
  const transcribing = state === "transcribing";
  const accessibleLabel = recording ? t("voice.stop") : (label ?? t("voice.start"));

  return (
    <ConsentNotice
      open={state === "notice"}
      noticeKey="voice.noticeSpeech"
      onAllow={() => {
        grantVoiceConsent();
        setState("idle");
        void begin();
      }}
      onCancel={() => setState("idle")}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={transcribing}
        aria-label={accessibleLabel}
        aria-pressed={recording}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full",
          size === "lg" ? "size-[72px] bg-accent text-white hover:bg-accent/90" : "size-11 text-ink-2 hover:text-ink",
          recording && (size === "lg" ? "bg-ink" : "bg-accent-soft text-accent-soft-text"),
          className,
        )}
      >
        {recording ? (
          <span
            aria-hidden="true"
            data-testid="voice-level-ring"
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-accent"
            style={{ transform: `scale(${1 + level * 0.5})`, opacity: 0.35 + level * 0.65 }}
          />
        ) : null}
        {transcribing ? (
          <Loader2 size={size === "lg" ? 24 : 20} strokeWidth={1.75} className="animate-spin" aria-hidden="true" />
        ) : recording ? (
          <Square size={size === "lg" ? 24 : 16} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
        ) : (
          <Mic size={size === "lg" ? 24 : 20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </ConsentNotice>
  );
}
