import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const preinstalledChromium = "/opt/pw-browsers/chromium";

const port = Number(process.env.E2E_PORT ?? 8787);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    reducedMotion: "reduce",
    launchOptions: {
      ...(existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {}),
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    permissions: ["microphone"],
  },
  webServer: {
    command: "npm-run-all build:web start",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { PORT: String(port), SARVAM_API_KEY: "" },
  },
});
