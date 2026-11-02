import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
  "@web": fileURLToPath(new URL("./src/web", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          setupFiles: ["./src/web/test-setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
    ],
  },
});
