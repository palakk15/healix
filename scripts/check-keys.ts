import { loadEnv } from "../server/env";
import { apiKeyHeader } from "../server/sarvam/wire";

const env = loadEnv();
const timeout = 20000;

type Outcome = { ok: boolean; status: number; message: string };

async function call(url: string, init: RequestInit): Promise<Outcome> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
    const text = await response.text();
    let message = "";
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string; message?: string; detail?: string };
      const error = typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
      message = error ?? parsed.message ?? parsed.detail ?? "";
    } catch {
      message = text.slice(0, 120);
    }
    return { ok: response.ok, status: response.status, message: String(message).slice(0, 200) };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? `${error.name}: ${error.message}` : "network error" };
  }
}

function show(label: string, outcome: Outcome, hint?: string): void {
  const mark = outcome.ok ? "OK    " : "FAILED";
  const detail = outcome.ok ? "" : ` (${outcome.status || "no answer"}${outcome.message ? `: ${outcome.message}` : ""})`;
  console.log(`  [${mark}] ${label}${detail}`);
  if (!outcome.ok && hint) console.log(`           -> ${hint}`);
}

function silentWav(): Blob {
  const rate = 16000;
  const samples = rate;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: "audio/wav" });
}

async function checkGroq(): Promise<void> {
  console.log("\nGroq (the report chatbot)");
  if (!env.GROQ_API_KEY) return console.log("  [SKIPPED] GROQ_API_KEY is empty in server/.env");
  if (!env.GROQ_MODEL) return console.log("  [FAILED] GROQ_MODEL is empty in server/.env. Add: GROQ_MODEL=openai/gpt-oss-120b");
  const base = env.GROQ_BASE_URL.replace(/\/$/, "");
  const headers = { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" };
  const models = await call(`${base}/models`, { headers });
  show("key accepted", models, models.status === 401 ? "The key is wrong or was deleted. Create a new one at console.groq.com and paste it after GROQ_API_KEY= with no spaces or quotes." : "Check your internet connection or firewall.");
  if (!models.ok) return;
  const listing = await fetch(`${base}/models`, { headers }).then((response) => response.json() as Promise<{ data?: Array<{ id: string }> }>).catch(() => ({ data: [] }));
  const ids = (listing.data ?? []).map((entry) => entry.id);
  const known = ids.includes(env.GROQ_MODEL);
  console.log(`  [${known ? "OK    " : "FAILED"}] model ${env.GROQ_MODEL} ${known ? "exists" : "was not found for this key"}`);
  if (!known) console.log(`           -> Pick one of: ${ids.filter((id) => !/whisper|guard|tts/i.test(id)).slice(0, 8).join(", ")}`);
  const chat = await call(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: env.GROQ_MODEL, messages: [{ role: "user", content: "Reply with the single word ready." }], max_tokens: 200, ...(/gpt-oss/i.test(env.GROQ_MODEL) ? { reasoning_effort: "low" } : {}) }),
  });
  show("a test question was answered", chat, chat.status === 429 ? "Rate limit reached. Wait a minute and try again." : "Fix the model name above, then run this check again.");
}

async function checkSarvam(): Promise<void> {
  console.log("\nSarvam (voice and language)");
  if (!env.SARVAM_API_KEY) return console.log("  [SKIPPED] SARVAM_API_KEY is empty in server/.env");
  const base = env.SARVAM_BASE_URL.replace(/\/$/, "");
  const key = { [apiKeyHeader]: env.SARVAM_API_KEY };
  const json = { ...key, "content-type": "application/json" };

  const translate = await call(`${base}/translate`, {
    method: "POST",
    headers: json,
    body: JSON.stringify({ input: "Hello", source_language_code: "en-IN", target_language_code: "hi-IN", ...(env.SARVAM_TRANSLATE_MODEL ? { model: env.SARVAM_TRANSLATE_MODEL } : {}) }),
  });
  show(`translate${env.SARVAM_TRANSLATE_MODEL ? ` (${env.SARVAM_TRANSLATE_MODEL})` : " (default model)"}`, translate, translate.status === 403 || translate.status === 401 ? "The key was rejected. Copy it again from dashboard.sarvam.ai." : "Leave SARVAM_TRANSLATE_MODEL empty to use Sarvam's default.");

  const ttsModels = env.SARVAM_TTS_MODEL ? [env.SARVAM_TTS_MODEL] : ["bulbul:v4-flash", "bulbul:v3"];
  let ttsWorks = "";
  for (const model of ttsModels) {
    const outcome = await call(`${base}/text-to-speech`, { method: "POST", headers: json, body: JSON.stringify({ text: "Hello", language_code: "en-IN", model }) });
    show(`text to speech with model ${model}`, outcome);
    if (outcome.ok && !ttsWorks) ttsWorks = model;
  }
  if (!env.SARVAM_TTS_MODEL && ttsWorks) console.log(`  >>> Add to server/.env:  SARVAM_TTS_MODEL=${ttsWorks}`);

  const sttModels = env.SARVAM_STT_MODEL ? [env.SARVAM_STT_MODEL] : ["saaras:v3", "saarika:v2.5"];
  let sttWorks = "";
  for (const model of sttModels) {
    const form = new FormData();
    form.set("file", silentWav(), "silence.wav");
    form.set("model", model);
    const outcome = await call(`${base}/speech-to-text`, { method: "POST", headers: key, body: form });
    show(`speech to text with model ${model}`, outcome, "A message that mentions the model means the name is wrong. Check docs.sarvam.ai for the current names.");
    if (outcome.ok && !sttWorks) sttWorks = model;
  }
  if (!env.SARVAM_STT_MODEL && sttWorks) console.log(`  >>> Add to server/.env:  SARVAM_STT_MODEL=${sttWorks}`);
}

console.log(`Healix key check. DATA_MODE=${env.DATA_MODE}. No keys are printed.`);
await checkGroq();
await checkSarvam();
console.log("\nAfter changing server/.env, stop npm run dev with Ctrl+C and start it again.");
