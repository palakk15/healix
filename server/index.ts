import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { compress } from "hono/compress";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAppHandle, groqConfigFor } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const handle = createAppHandle(env, { startSimulator: true });
const app = handle.app;

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(rootDirectory, "dist");

if (process.env.NODE_ENV === "production" && existsSync(distDirectory)) {
  const indexPath = resolve(distDirectory, "index.html");
  const compressor = compress();
  app.use("*", (context, next) => (context.req.path.startsWith("/api") ? next() : compressor(context, next)));
  app.use(
    "/*",
    serveStatic({
      root: "./dist",
      onFound: (path, context) => {
        const cache = path.includes("/assets/") ? "public, max-age=31536000, immutable" : path.endsWith(".html") || context.req.path === "/" ? "no-cache" : "public, max-age=3600";
        context.header("Cache-Control", cache);
      },
    }),
  );
  app.get("*", (context) => {
    context.header("Cache-Control", "no-cache");
    return context.html(readFileSync(indexPath, "utf8"));
  });
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Healix server on http://localhost:${info.port} (DATA_MODE=${env.DATA_MODE})`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${env.PORT} is already in use. Another copy of Healix is still running (maybe an older folder). Close that terminal with Ctrl+C, then run npm run dev again.`);
  } else {
    console.error("The Healix server could not start:", error.message);
  }
  process.exit(1);
});

function describeSetup(): string[] {
  const lines: string[] = [];
  lines.push(groqConfigFor(env) ? `Groq chatbot: on (model ${env.GROQ_MODEL})` : `Groq chatbot: off (${env.GROQ_API_KEY ? "GROQ_MODEL is empty" : "GROQ_API_KEY is empty"}), the built-in reader answers`);
  if (!env.SARVAM_API_KEY) {
    lines.push("Sarvam voice: off (SARVAM_API_KEY is empty)");
  } else {
    const missing = [
      env.SARVAM_STT_MODEL ? null : "SARVAM_STT_MODEL (the mic)",
      env.SARVAM_TTS_MODEL ? null : "SARVAM_TTS_MODEL (Listen)",
    ].filter(Boolean);
    lines.push(missing.length === 0 ? "Sarvam voice: on" : `Sarvam voice: key found but ${missing.join(" and ")} empty, so those features will not work. Run npm run check:keys`);
  }
  return lines;
}

if (process.env.NODE_ENV !== "test") for (const line of describeSetup()) console.log(line);

function shutdown() {
  handle.saver?.flush();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
