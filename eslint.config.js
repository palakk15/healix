import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const domGlobals = ["window", "document", "navigator", "localStorage", "sessionStorage", "HTMLElement", "Audio", "MediaRecorder", "indexedDB"];

export default tseslint.config(
  { ignores: ["dist", "node_modules", "design", "src/web/styles/theme.generated.css", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["server/**/*.ts", "scripts/**/*.ts", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/core/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.es2022 },
    rules: {
      "no-restricted-globals": ["error", ...domGlobals],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@web/*", "**/web/**", "react-dom", "react-dom/*", "tailwindcss", "motion", "motion/*", "lucide-react"], message: "src/core must stay free of DOM, web and styling code so it can be reused in React Native." },
          ],
        },
      ],
    },
  },
);
