import type { ServerEnv } from "../env";

export type SarvamMode = "live" | "mock" | "off";

export interface SarvamConfig {
  mode: SarvamMode;
  apiKey: string | undefined;
  baseUrl: string;
  sttModel: string | undefined;
  ttsModel: string | undefined;
  translateModel: string | undefined;
  speakers: { en: string | undefined; hi: string | undefined; mr: string | undefined };
  timeoutMs: number;
  rateLimitPerMinute: number;
}

export function sarvamModeFor(env: ServerEnv): SarvamMode {
  if (env.SARVAM_API_KEY) return "live";
  return env.DATA_MODE === "mock" ? "mock" : "off";
}

export function buildSarvamConfig(env: ServerEnv): SarvamConfig {
  return {
    mode: sarvamModeFor(env),
    apiKey: env.SARVAM_API_KEY,
    baseUrl: env.SARVAM_BASE_URL.replace(/\/$/, ""),
    sttModel: env.SARVAM_STT_MODEL,
    ttsModel: env.SARVAM_TTS_MODEL,
    translateModel: env.SARVAM_TRANSLATE_MODEL,
    speakers: { en: env.SARVAM_TTS_SPEAKER_EN, hi: env.SARVAM_TTS_SPEAKER_HI, mr: env.SARVAM_TTS_SPEAKER_MR },
    timeoutMs: env.SARVAM_TIMEOUT_MS,
    rateLimitPerMinute: env.SARVAM_RATE_LIMIT_PER_MINUTE,
  };
}
