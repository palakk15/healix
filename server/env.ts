import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(serverDirectory, ".env");
if (existsSync(envFile)) config({ path: envFile });

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  DATA_MODE: z.enum(["mock", "live", "local"]).default("mock"),
  LOCAL_DATA_DIR: optionalText,
  AUTH_CODE: optionalText.refine((value) => value === undefined || /^\d{6}$/.test(value), "AUTH_CODE must be exactly 6 digits"),
  STAFF_PHONES: optionalText,
  BACKEND_URL: z.string().url().default("http://localhost:8000"),
  AI_URL: z.string().url().default("http://localhost:8001"),
  GROQ_API_KEY: optionalText,
  GROQ_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  GROQ_MODEL: optionalText,
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SARVAM_API_KEY: optionalText,
  SARVAM_BASE_URL: z.string().url().default("https://api.sarvam.ai"),
  SARVAM_STT_MODEL: optionalText,
  SARVAM_TTS_MODEL: optionalText,
  SARVAM_TTS_SPEAKER_EN: optionalText,
  SARVAM_TTS_SPEAKER_HI: optionalText,
  SARVAM_TTS_SPEAKER_MR: optionalText,
  SARVAM_TRANSLATE_MODEL: optionalText,
  SARVAM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  SARVAM_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  return envSchema.parse(source);
}
