import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { istMinutesOfDay } from "@core/domain/time";
import { logger } from "hono/logger";
import type { ServerEnv } from "./env";
import { createMockApi, defaultLatency, noLatency, type MockLatency } from "./mock/routes";
import { Simulator } from "./mock/simulator";
import { MockWorld, type StaffAccount } from "./mock/world";
import { createProxy } from "./proxy";
import { createSaver, ensureSecret, loadSnapshot, type Saver } from "./live/persist";
import { createReportReader } from "./live/reader";
import type { GroqConfig, GroqTransport } from "./rag/groq";
import { VectorStore } from "./rag/store";
import { buildSarvamConfig, sarvamModeFor, type SarvamMode } from "./sarvam/config";
import { createSarvamApi } from "./sarvam/routes";
import { SarvamService } from "./sarvam/service";
import type { SarvamTransport } from "./sarvam/client";
import type { RateLimiter } from "./sarvam/rateLimit";

export interface MetaPayload {
  data_mode: ServerEnv["DATA_MODE"];
  sarvam_enabled: boolean;
  sarvam_mode: SarvamMode;
  assistant_mode: "groq" | "local";
}

export function groqConfigFor(env: ServerEnv): GroqConfig | undefined {
  if (!env.GROQ_API_KEY || !env.GROQ_MODEL) return undefined;
  return { apiKey: env.GROQ_API_KEY, baseUrl: env.GROQ_BASE_URL, model: env.GROQ_MODEL, timeoutMs: env.GROQ_TIMEOUT_MS };
}

export function buildMeta(env: ServerEnv): MetaPayload {
  return {
    data_mode: env.DATA_MODE,
    sarvam_enabled: Boolean(env.SARVAM_API_KEY),
    sarvam_mode: sarvamModeFor(env),
    assistant_mode: groqConfigFor(env) ? "groq" : "local",
  };
}

export interface AppOptions {
  sarvamTransport?: SarvamTransport;
  sarvamRateLimiter?: RateLimiter;
  groqTransport?: GroqTransport;
  world?: MockWorld;
  latency?: MockLatency;
  startSimulator?: boolean;
}

export interface AppHandle {
  app: Hono;
  world: MockWorld;
  simulator: Simulator;
  saver: Saver | null;
}

export function parseStaffPhones(text: string | undefined): StaffAccount[] | undefined {
  if (!text) return undefined;
  const accounts = text
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): StaffAccount[] => {
      const [phone, hospitalId] = entry.split(":").map((part) => part.trim());
      return phone && hospitalId ? [{ phone, hospitalId: hospitalId.startsWith("hosp_") ? hospitalId : `hosp_${hospitalId}` }] : [];
    });
  return accounts.length > 0 ? accounts : undefined;
}

const serverDirectory = dirname(fileURLToPath(import.meta.url));

function createLocalWorld(env: ServerEnv): { world: MockWorld; saver: Saver; dataDirectory: string } {
  const dataDirectory = resolve(env.LOCAL_DATA_DIR ?? resolve(serverDirectory, "data", "local"));
  mkdirSync(dataDirectory, { recursive: true });
  const world = new MockWorld({
    mode: "local",
    tokenSecret: ensureSecret(dataDirectory),
    staff: parseStaffPhones(env.STAFF_PHONES),
    uploadDirectory: resolve(dataDirectory, "uploads"),
    startMinutesOfDay: istMinutesOfDay(new Date()),
  });
  world.reports.setExtractor(createReportReader(resolve(dataDirectory, "ocr-cache")));
  const file = resolve(dataDirectory, "state.json");
  const restored = loadSnapshot(world, file);
  if (process.env.NODE_ENV !== "test") console.log(restored ? `Loaded saved data from ${file}` : `Starting fresh, data will be saved to ${file}`);
  return { world, saver: createSaver(world, file), dataDirectory };
}

export function createAppHandle(env: ServerEnv, options: AppOptions = {}): AppHandle {
  const app = new Hono();
  const local = !options.world && env.DATA_MODE === "local" ? createLocalWorld(env) : null;
  const world = options.world ?? local?.world ?? new MockWorld();
  const simulator = new Simulator(world);
  const saver = local?.saver ?? null;

  if (process.env.NODE_ENV !== "test") app.use("*", logger());

  const api = new Hono();
  api.get("/health", (context) => context.json({ ok: true }));
  api.get("/meta", (context) => context.json(buildMeta(env)));

  const sarvam = new SarvamService(buildSarvamConfig(env), options.sarvamTransport);
  api.route("/sarvam", createSarvamApi(sarvam, options.sarvamRateLimiter));

  if (env.DATA_MODE === "mock" || env.DATA_MODE === "local") {
    if (env.DATA_MODE === "mock" && options.startSimulator) simulator.startLive();
    if (saver) {
      api.use("*", async (context, next) => {
        await next();
        if (context.req.method !== "GET" && context.res.status < 400) saver.schedule();
      });
      if (options.startSimulator) {
        const housekeeping = setInterval(() => world.engine.refreshStatuses(), 30_000);
        housekeeping.unref();
      }
    }
    const authCode = env.AUTH_CODE ?? "123456";
    if (env.DATA_MODE === "local" && !env.AUTH_CODE && process.env.NODE_ENV !== "test") {
      console.warn("AUTH_CODE is not set, so the sign-in code is 123456. Set AUTH_CODE in server/.env before real use.");
    }
    api.route(
      "/",
      createMockApi({
        world,
        simulator,
        otp: authCode,
        onReset: () => sarvam.resetDemo(),
        rag: {
          store: new VectorStore(local ? resolve(local.dataDirectory, "vectors.json") : undefined),
          groq: groqConfigFor(env),
          transport: options.groqTransport,
        },
        latency: env.DATA_MODE === "local" ? noLatency : (options.latency ?? (process.env.NODE_ENV === "test" ? noLatency : defaultLatency)),
      }),
    );
  } else {
    api.route("/", createProxy(env));
  }

  api.all("*", (context) =>
    context.json({ error: { code: "not_found", message: "Unknown API route", retry: false } }, 404),
  );

  app.route("/api", api);

  app.onError((_error, context) =>
    context.json({ error: { code: "internal_error", message: "Something went wrong", retry: true } }, 500),
  );

  return { app, world, simulator, saver };
}

export function createApp(env: ServerEnv, options: AppOptions = {}): Hono {
  return createAppHandle(env, options).app;
}
