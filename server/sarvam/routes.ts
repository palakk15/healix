import { Hono, type Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import {
  languageCodeSchema,
  lidRequestSchema,
  speechPurposeSchema,
  translateRequestSchema,
  transliterateRequestSchema,
  ttsRequestSchema,
} from "@core/api/schemas/sarvam";
import type { z } from "zod";
import { createRateLimiter, type RateLimiter } from "./rateLimit";
import { SarvamError } from "./errors";
import type { SarvamService } from "./service";

export const maxAudioBytes = 5 * 1024 * 1024;

function isUpload(value: unknown): value is Blob & { name?: string } {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "size" in value && typeof (value as Blob).size === "number";
}

function clientAddress(context: Context): string {
  const forwarded = context.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getConnInfo(context).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function createSarvamApi(service: SarvamService, limiter?: RateLimiter): Hono {
  const api = new Hono();
  const rateLimiter = limiter ?? createRateLimiter(service.config.rateLimitPerMinute);

  api.use("*", async (context, next) => {
    const outcome = rateLimiter.check(clientAddress(context));
    if (!outcome.allowed) {
      context.header("Retry-After", String(outcome.retryAfterSeconds));
      throw new SarvamError(429, "rate_limited", "Too many voice requests. Please wait a moment and try again.", true);
    }
    await next();
  });

  api.onError((error, context) => {
    if (error instanceof SarvamError) return context.json(error.toBody(), error.status);
    return context.json({ error: { code: "internal_error", message: "Something went wrong", retry: true } }, 500);
  });

  const parse = async <Schema extends z.ZodType>(context: Context, schema: Schema): Promise<z.infer<Schema>> => {
    const raw: unknown = await context.req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new SarvamError(400, "invalid_request", "The request was not understood", false);
    return parsed.data;
  };

  api.post("/stt", async (context) => {
    const form = await context.req.parseBody().catch(() => null);
    const audio = form?.audio;
    if (!isUpload(audio)) throw new SarvamError(400, "invalid_request", "An audio file is required", false);
    if (audio.size > maxAudioBytes) throw new SarvamError(413, "audio_too_large", "That recording is too long. Please try a shorter one.", false);

    const language = languageCodeSchema.catch("en").parse(form?.language);
    const purpose = speechPurposeSchema.catch("any").parse(form?.purpose);
    return context.json(await service.transcribe({ audio, fileName: audio.name || "speech.wav", language, purpose }));
  });

  api.post("/tts", async (context) => {
    const request = await parse(context, ttsRequestSchema);
    const audios = await service.speak(request.text, request.language, request.pace);
    return context.json({ audios, language: request.language, source: "sarvam" as const });
  });

  api.post("/translate", async (context) => {
    const request = await parse(context, translateRequestSchema);
    return context.json(await service.translate(request.text, request.target, request.source));
  });

  api.post("/transliterate", async (context) => {
    const request = await parse(context, transliterateRequestSchema);
    return context.json({ text: await service.transliterate(request.text, request.from, request.to) });
  });

  api.post("/lid", async (context) => {
    const request = await parse(context, lidRequestSchema);
    return context.json(await service.identify(request.text));
  });

  return api;
}
