import { describe, expect, it } from "vitest";
import { createAppHandle } from "../app";
import { loadEnv } from "../env";
import { noLatency } from "../mock/routes";
import type { SarvamTransport } from "./client";
import { createRateLimiter } from "./rateLimit";

const secret = "sk-test-secret-key-123";

const liveEnv = {
  SARVAM_API_KEY: secret,
  SARVAM_STT_MODEL: "stt-model-x",
  SARVAM_TTS_MODEL: "tts-model-y",
  SARVAM_TRANSLATE_MODEL: "translate-model-z",
  SARVAM_TTS_SPEAKER_EN: "voice-en",
  SARVAM_TTS_SPEAKER_HI: "voice-hi",
  SARVAM_TTS_SPEAKER_MR: "voice-mr",
};

interface Recorded {
  url: string;
  init: RequestInit;
}

function recordingTransport(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Recorded[] = [];
  const transport: SarvamTransport = {
    fetch: async (url, init) => {
      calls.push({ url, init });
      return respond(url, init);
    },
  };
  return { calls, transport };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function appWith(env: Record<string, string>, transport?: SarvamTransport, rateLimiter?: ReturnType<typeof createRateLimiter>) {
  return createAppHandle(loadEnv(env), { latency: noLatency, sarvamTransport: transport, sarvamRateLimiter: rateLimiter }).app;
}

function sttRequest(app: ReturnType<typeof appWith>, fields: { audio?: Blob | string; language?: string; purpose?: string; ip?: string } = {}) {
  const form = new FormData();
  if (fields.audio !== undefined) form.set("audio", fields.audio instanceof Blob ? fields.audio : new Blob([fields.audio]), "speech.wav");
  if (fields.language) form.set("language", fields.language);
  if (fields.purpose) form.set("purpose", fields.purpose);
  return app.request("/api/sarvam/stt", { method: "POST", body: form, headers: fields.ip ? { "x-forwarded-for": fields.ip } : {} });
}

const post = (app: ReturnType<typeof appWith>, path: string, body: unknown, ip?: string) =>
  app.request(`/api/sarvam${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) },
    body: JSON.stringify(body),
  });

describe("speech to text (live)", () => {
  it("sends the key in api-subscription-key and the model, mode and audio as multipart fields", async () => {
    const { calls, transport } = recordingTransport(() => json({ request_id: "r1", transcript: " जेवल्यानंतर पोटात जळजळ ", language_code: "mr-IN" }));
    const app = appWith(liveEnv, transport);
    const response = await sttRequest(app, { audio: "RIFFfake", language: "mr", purpose: "symptoms" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcript: "जेवल्यानंतर पोटात जळजळ", language: "mr", source: "sarvam" });

    const call = calls[0];
    expect(call?.url).toBe("https://api.sarvam.ai/speech-to-text");
    const headers = call?.init.headers as Record<string, string>;
    expect(headers["api-subscription-key"]).toBe(secret);
    expect(headers).not.toHaveProperty("Content-Type");
    const form = call?.init.body as FormData;
    expect(form.get("model")).toBe("stt-model-x");
    expect(form.get("mode")).toBe("transcribe");
    expect(form.get("language_code")).toBe("unknown");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect(call?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses codemix mode for Hinglish and keeps Latin-script Hindi as Hinglish", async () => {
    const { calls, transport } = recordingTransport(() => json({ transcript: "do din se pet mein jalan", language_code: "hi-IN" }));
    const app = appWith(liveEnv, transport);
    const response = await sttRequest(app, { audio: "x", language: "hinglish" });
    expect((await response.json() as { language: string }).language).toBe("hinglish");
    expect((calls[0]?.init.body as FormData).get("mode")).toBe("codemix");
  });

  it("reports unsupported languages as null so the page keeps its own", async () => {
    const { transport } = recordingTransport(() => json({ transcript: "வலி", language_code: "ta-IN" }));
    const body = (await (await sttRequest(appWith(liveEnv, transport), { audio: "x" })).json()) as { language: unknown };
    expect(body.language).toBeNull();
  });

  it("answers 400 no_speech when nothing was heard", async () => {
    const { transport } = recordingTransport(() => json({ transcript: "   ", language_code: "en-IN" }));
    const response = await sttRequest(appWith(liveEnv, transport), { audio: "x" });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string; retry: boolean } }).error).toMatchObject({ code: "no_speech", retry: true });
  });

  it("asks for the model to be configured instead of guessing one", async () => {
    const { calls, transport } = recordingTransport(() => json({}));
    const response = await sttRequest(appWith({ SARVAM_API_KEY: secret }, transport), { audio: "x" });
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("sarvam_not_configured");
    expect(calls).toHaveLength(0);
  });

  it("rejects missing, empty and oversized audio", async () => {
    const app = appWith(liveEnv, recordingTransport(() => json({})).transport);
    expect((await sttRequest(app, {})).status).toBe(400);
    expect((await sttRequest(app, { audio: "" })).status).toBe(400);
    const tooBig = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    const response = await sttRequest(app, { audio: tooBig });
    expect(response.status).toBe(413);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("audio_too_large");
  });
});

describe("failure handling never blocks the page and never leaks the key", () => {
  const cases: Array<[string, () => Response | Promise<Response>, number, string, boolean]> = [
    ["rate limited upstream", () => json({}, 429), 429, "sarvam_rate_limited", true],
    ["bad credentials", () => json({}, 401), 502, "sarvam_auth_failed", false],
    ["rejected request", () => json({}, 422), 502, "sarvam_rejected_request", false],
    ["server error", () => json({}, 500), 502, "sarvam_failed", true],
    ["unreadable answer", () => new Response("<html>oops</html>", { status: 200 }), 502, "sarvam_bad_response", true],
    ["unexpected shape", () => json({ hello: "world" }), 502, "sarvam_bad_response", true],
  ];

  it.each(cases)("%s", async (_name, respond, status, code, retry) => {
    const app = appWith(liveEnv, recordingTransport(respond).transport);
    const response = await sttRequest(app, { audio: "x" });
    const text = await response.text();
    expect(response.status).toBe(status);
    expect(JSON.parse(text).error).toMatchObject({ code, retry });
    expect(text).not.toContain(secret);
  });

  it("times out after the configured limit with a retryable 504", async () => {
    const { transport } = recordingTransport(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const app = appWith({ ...liveEnv, SARVAM_TIMEOUT_MS: "40" }, transport);
    const started = Date.now();
    const response = await sttRequest(app, { audio: "x" });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(response.status).toBe(504);
    expect(((await response.json()) as { error: { code: string; retry: boolean } }).error).toMatchObject({ code: "sarvam_timeout", retry: true });
  });

  it("defaults the timeout to 8 seconds", () => {
    expect(loadEnv({}).SARVAM_TIMEOUT_MS).toBe(8000);
  });

  it("maps a network failure to 502 sarvam_unreachable", async () => {
    const app = appWith(liveEnv, { fetch: () => Promise.reject(new TypeError("fetch failed")) });
    const response = await sttRequest(app, { audio: "x" });
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("sarvam_unreachable");
  });
});

describe("offline demo mode (no key)", () => {
  it("returns canned transcripts for the demo phrases, per language and purpose", async () => {
    const app = appWith({});
    const say = async (language: string, purpose: string) => (await (await sttRequest(app, { audio: "x", language, purpose })).json()) as { transcript: string; language: string; source: string };

    expect(await say("mr", "symptoms")).toEqual({ transcript: "जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून", language: "mr", source: "mock" });
    expect((await say("hinglish", "symptoms")).transcript).toBe("Do din se pet mein jalan ho rahi hai");
    expect((await say("hi", "symptoms")).transcript).toBe("मुझे दो दिन से सिर में बहुत दर्द है");
    expect((await say("hi", "symptoms")).transcript).toBe("बच्चे को तेज बुखार है, 2 महीने का है");
    expect((await say("hi", "symptoms")).transcript).toBe("मुझे दो दिन से सिर में बहुत दर्द है");
    expect((await say("en", "symptoms")).transcript).toBe("Knee pain when climbing stairs for 2 weeks");
    expect((await say("en", "symptoms")).transcript).toBe("chest pain and sweating");
    expect((await say("mr", "assistant")).transcript).toBe("मधुमेहात व्हिटॅमिन डी का महत्त्वाचे आहे?");
    expect((await say("en", "assistant")).transcript).toBe("What is dengue and when should I go to hospital?");
    expect((await say("en", "assistant")).transcript).toBe("How many metformin tablets should I take?");
  });

  it("still validates that audio arrived", async () => {
    expect((await sttRequest(appWith({}), { audio: "" })).status).toBe(400);
  });

  it("has no fake voice: listen and transliterate are unavailable, translate passes text through, language id works locally", async () => {
    const app = appWith({});
    const tts = await post(app, "/tts", { text: "hello", language: "en" });
    expect(tts.status).toBe(503);
    expect(((await tts.json()) as { error: { code: string } }).error.code).toBe("sarvam_unavailable");
    expect((await post(app, "/transliterate", { text: "pet dard", from: "hinglish", to: "hi" })).status).toBe(503);

    const translated = (await (await post(app, "/translate", { text: "Hello", target: "mr" })).json()) as Record<string, unknown>;
    expect(translated).toMatchObject({ text: "Hello", source: "passthrough", degraded: false });

    const lid = (await (await post(app, "/lid", { text: "मला पोटात दुखत आहे" })).json()) as Record<string, unknown>;
    expect(lid).toEqual({ language: "mr", source: "local" });
  });

  it("is fully off in live data mode without a key", async () => {
    const app = appWith({ DATA_MODE: "live" });
    expect((await sttRequest(app, { audio: "x" })).status).toBe(503);
    const translated = (await (await post(app, "/translate", { text: "Hello", target: "hi" })).json()) as Record<string, unknown>;
    expect(translated).toMatchObject({ source: "passthrough", degraded: true });
  });
});

describe("text to speech", () => {
  const audio = (index: number) => json({ request_id: `t${index}`, audios: [`UklGR${index}`] });

  it("sends text, language, model, pace and the right speaker for each language", async () => {
    const { calls, transport } = recordingTransport(() => audio(1));
    const app = appWith(liveEnv, transport);

    const marathi = await post(app, "/tts", { text: "तुमची रिपोर्ट सामान्य आहे.", language: "mr", pace: 0.85 });
    expect(await marathi.json()).toEqual({ audios: ["UklGR1"], language: "mr", source: "sarvam" });
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(calls[0]?.url).toBe("https://api.sarvam.ai/text-to-speech");
    expect(body).toMatchObject({ text: "तुमची रिपोर्ट सामान्य आहे.", model: "tts-model-y", pace: 0.85, speaker: "voice-mr", language_code: "mr-IN" });
    expect((calls[0]?.init.headers as Record<string, string>)["api-subscription-key"]).toBe(secret);
    expect((calls[0]?.init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

    await post(app, "/tts", { text: "Hello there.", language: "en" });
    await post(app, "/tts", { text: "Namaste.", language: "hinglish" });
    const sent = calls.map((call) => JSON.parse(String(call.init.body)) as Record<string, unknown>);
    expect(sent[1]).toMatchObject({ speaker: "voice-en", language_code: "en-IN", pace: 1 });
    expect(sent[2]).toMatchObject({ speaker: "voice-hi", language_code: "hi-IN" });
  });

  it("leaves the speaker out when none is configured", async () => {
    const { calls, transport } = recordingTransport(() => audio(1));
    await post(appWith({ SARVAM_API_KEY: secret, SARVAM_TTS_MODEL: "m" }, transport), "/tts", { text: "Hello.", language: "en" });
    expect(JSON.parse(String(calls[0]?.init.body))).not.toHaveProperty("speaker");
  });

  it("splits long text into several calls under the 2,500 character limit and returns the audio in order", async () => {
    let counter = 0;
    const { calls, transport } = recordingTransport(() => audio(++counter));
    const sentence = "यह एक छोटा वाक्य है जो दोहराया जाता है।";
    const text = Array.from({ length: 200 }, () => sentence).join(" ");
    const response = await post(appWith(liveEnv, transport), "/tts", { text, language: "hi" });
    const payload = (await response.json()) as { audios: string[] };

    expect(calls.length).toBeGreaterThan(1);
    for (const call of calls) expect((JSON.parse(String(call.init.body)) as { text: string }).text.length).toBeLessThanOrEqual(2000);
    expect(payload.audios).toEqual(calls.map((_, index) => `UklGR${index + 1}`));
  });

  it("does not read citation markers aloud", async () => {
    const { calls, transport } = recordingTransport(() => audio(1));
    await post(appWith(liveEnv, transport), "/tts", { text: "Keep sugar steady [1]. Check vitamin D [2].", language: "en" });
    expect((JSON.parse(String(calls[0]?.init.body)) as { text: string }).text).toBe("Keep sugar steady. Check vitamin D.");
  });

  it("asks for the model to be configured, and rejects bad requests", async () => {
    const { calls, transport } = recordingTransport(() => audio(1));
    const noModel = await post(appWith({ SARVAM_API_KEY: secret }, transport), "/tts", { text: "Hello", language: "en" });
    expect(noModel.status).toBe(503);
    expect(calls).toHaveLength(0);
    const app = appWith(liveEnv, transport);
    expect((await post(app, "/tts", { text: "", language: "en" })).status).toBe(400);
    expect((await post(app, "/tts", { text: "Hello", language: "klingon" })).status).toBe(400);
    expect((await post(app, "/tts", { text: "Hello", language: "en", pace: 9 })).status).toBe(400);
  });

  it("surfaces an upstream failure instead of hanging", async () => {
    const app = appWith(liveEnv, recordingTransport(() => json({}, 500)).transport);
    expect((await post(app, "/tts", { text: "Hello", language: "en" })).status).toBe(502);
  });
});

describe("translate, transliterate and language identification", () => {
  it("translates, then serves the repeat from the cache without calling Sarvam again", async () => {
    const { calls, transport } = recordingTransport(() => json({ translated_text: "मराठी मजकूर", source_language_code: "en-IN" }));
    const app = appWith(liveEnv, transport);
    const first = await (await post(app, "/translate", { text: "Doctor speaks Marathi", target: "mr", source: "en" })).json();
    expect(first).toEqual({ text: "मराठी मजकूर", target: "mr", cached: false, source: "sarvam", degraded: false });
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ input: "Doctor speaks Marathi", source_language_code: "en-IN", target_language_code: "mr-IN", model: "translate-model-z" });

    const second = await (await post(app, "/translate", { text: "Doctor speaks Marathi", target: "mr", source: "en" })).json();
    expect(second).toMatchObject({ text: "मराठी मजकूर", cached: true });
    expect(calls).toHaveLength(1);
  });

  it("asks Sarvam to detect the source when none is given", async () => {
    const { calls, transport } = recordingTransport(() => json({ translated_text: "x" }));
    await post(appWith(liveEnv, transport), "/translate", { text: "Hello", target: "hi" });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ source_language_code: "auto" });
  });

  it("falls back to the original text when translation fails, and skips same-language calls", async () => {
    const { calls, transport } = recordingTransport(() => json({}, 500));
    const app = appWith(liveEnv, transport);
    expect(await (await post(app, "/translate", { text: "Hello", target: "hi" })).json()).toMatchObject({ text: "Hello", source: "passthrough", degraded: true });
    const callsBefore = calls.length;
    expect(await (await post(app, "/translate", { text: "Hello", target: "en", source: "en" })).json()).toMatchObject({ text: "Hello", degraded: false });
    expect(calls).toHaveLength(callsBefore);
  });

  it("transliterates Latin-script Hindi into Devanagari", async () => {
    const { calls, transport } = recordingTransport(() => json({ transliterated_text: "पेट में दर्द" }));
    const response = await post(appWith(liveEnv, transport), "/transliterate", { text: "pet mein dard", from: "hinglish", to: "hi" });
    expect(await response.json()).toEqual({ text: "पेट में दर्द" });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ input: "pet mein dard", source_language_code: "en-IN", target_language_code: "hi-IN" });
    expect(calls[0]?.url).toBe("https://api.sarvam.ai/transliterate");
  });

  it("surfaces a transliteration failure so the toggle can hide itself", async () => {
    const app = appWith(liveEnv, recordingTransport(() => json({}, 500)).transport);
    expect((await post(app, "/transliterate", { text: "x", from: "hinglish", to: "hi" })).status).toBe(502);
  });

  it("identifies the language with Sarvam, and falls back to the local guess when it fails", async () => {
    const good = recordingTransport(() => json({ language_code: "mr-IN", script_code: "Deva" }));
    expect(await (await post(appWith(liveEnv, good.transport), "/lid", { text: "मला त्रास होतो" })).json()).toEqual({ language: "mr", source: "sarvam" });
    expect(good.calls[0]?.url).toBe("https://api.sarvam.ai/text-lid");
    expect(JSON.parse(String(good.calls[0]?.init.body))).toEqual({ input: "मला त्रास होतो" });

    const broken = appWith(liveEnv, recordingTransport(() => json({}, 500)).transport);
    expect(await (await post(broken, "/lid", { text: "मेरे पेट में दर्द है" })).json()).toEqual({ language: "hi", source: "local" });
  });
});

describe("rate limiting", () => {
  it("allows the limit, then answers 429 with Retry-After, per client address", async () => {
    const limiter = createRateLimiter(3);
    const app = appWith({}, undefined, limiter);
    const ok = [] as number[];
    for (let index = 0; index < 3; index += 1) ok.push((await post(app, "/lid", { text: "hello" }, "10.0.0.1")).status);
    expect(ok).toEqual([200, 200, 200]);

    const blocked = await post(app, "/lid", { text: "hello" }, "10.0.0.1");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(((await blocked.json()) as { error: { code: string; retry: boolean } }).error).toMatchObject({ code: "rate_limited", retry: true });

    expect((await post(app, "/lid", { text: "hello" }, "10.0.0.2")).status).toBe(200);
  });

  it("resets after the window", () => {
    let now = 1_000_000;
    const limiter = createRateLimiter(2, 60_000, () => now);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 60 });
    now += 59_000;
    expect(limiter.check("a").retryAfterSeconds).toBe(1);
    now += 2_000;
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("uses the configured per-minute limit by default", () => {
    expect(loadEnv({}).SARVAM_RATE_LIMIT_PER_MINUTE).toBe(30);
  });
});

describe("meta and secrets", () => {
  it("tells the browser the voice mode but never the key", async () => {
    for (const [env, mode] of [[{}, "mock"], [{ SARVAM_API_KEY: secret }, "live"], [{ DATA_MODE: "live" }, "off"]] as const) {
      const response = await appWith(env).request("/api/meta");
      const text = await response.text();
      expect(JSON.parse(text).sarvam_mode).toBe(mode);
      expect(text).not.toContain(secret);
    }
  });
});

describe("demo reset", () => {
  it("starts the canned transcripts from the first phrase again", async () => {
    const app = appWith({});
    const say = async () => ((await (await sttRequest(app, { audio: "x", language: "en", purpose: "symptoms" })).json()) as { transcript: string }).transcript;
    expect(await say()).toBe("Knee pain when climbing stairs for 2 weeks");
    expect(await say()).toBe("chest pain and sweating");
    const handle = createAppHandle(loadEnv({}), { latency: noLatency });
    const local = async () => {
      const form = new FormData();
      form.set("audio", new Blob(["x"]), "s.wav");
      form.set("language", "en");
      form.set("purpose", "symptoms");
      return ((await (await handle.app.request("/api/sarvam/stt", { method: "POST", body: form })).json()) as { transcript: string }).transcript;
    };
    await local();
    const login = await handle.app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: "9000000001", otp: "123456" }) });
    const { access_token: token } = (await login.json()) as { access_token: string };
    await handle.app.request("/api/mock/simulator/reset", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    expect(await local()).toBe("Knee pain when climbing stairs for 2 weeks");
  });
});
