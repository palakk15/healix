import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const preinstalledChromium = "/opt/pw-browsers/chromium";
const port = 8789;

export default defineConfig({
  testDir: "./tests/groq",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    reducedMotion: "reduce",
    launchOptions: existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {},
  },
  webServer: [
    {
      command: "tsx scripts/fake-groq.ts",
      url: "http://localhost:9911/v1/models",
      extraHTTPHeaders: { authorization: "Bearer fake-key" },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node -e "require('fs').rmSync('test-results/groq-data',{recursive:true,force:true})" && npm-run-all build:web start`,
      url: `http://localhost:${port}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        PORT: String(port),
        DATA_MODE: "local",
        LOCAL_DATA_DIR: "test-results/groq-data",
        AUTH_CODE: "424242",
        SARVAM_API_KEY: "",
        GROQ_API_KEY: "fake-key",
        GROQ_MODEL: "fake-model",
        GROQ_BASE_URL: "http://localhost:9911/v1",
      },
    },
  ],
});
