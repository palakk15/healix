import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const preinstalledChromium = "/opt/pw-browsers/chromium";
const port = Number(process.env.E2E_LOCAL_PORT ?? 8788);

export default defineConfig({
  testDir: "./tests/local",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    reducedMotion: "reduce",
    launchOptions: existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {},
  },
  webServer: {
    command: `node -e "require('fs').rmSync('test-results/local-data',{recursive:true,force:true})" && npm-run-all build:web start`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(port),
      DATA_MODE: "local",
      LOCAL_DATA_DIR: "test-results/local-data",
      AUTH_CODE: "424242",
      STAFF_PHONES: "9000000001:karve",
      SARVAM_API_KEY: "",
    },
  },
});
