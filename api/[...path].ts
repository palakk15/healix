import { createAppHandle } from "../server/app";
import { loadEnv } from "../server/env";

// Keep the API behind one function so the in-memory demo world is shared by
// all routes handled by this warm function instance.
const env = loadEnv({
  ...process.env,
  DATA_MODE: process.env.VERCEL ? "mock" : process.env.DATA_MODE ?? "mock",
  AUTH_CODE: process.env.VERCEL ? "123456" : process.env.AUTH_CODE ?? "123456",
});
const app = createAppHandle(env, { startSimulator: false }).app;

export default {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request);
  },
};
