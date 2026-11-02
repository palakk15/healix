import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const heroFontPatterns = [
  /instrument-serif-latin-400-normal.*\.woff2$/,
  /instrument-serif-latin-400-italic.*\.woff2$/,
  /geist-latin-wght-normal.*\.woff2$/,
];

function preloadHeroFonts(): Plugin {
  return {
    name: "healix-preload-hero-fonts",
    transformIndexHtml: {
      order: "post",
      handler(html, context) {
        if (!context.bundle) return html;
        const tags = Object.keys(context.bundle)
          .filter((fileName) => heroFontPatterns.some((pattern) => pattern.test(fileName)))
          .map(
            (fileName) =>
              `<link rel="preload" href="/${fileName}" as="font" type="font/woff2" crossorigin>`,
          );
        return html.replace("</head>", `${tags.join("\n")}\n</head>`);
      },
    },
  };
}

const serverPort = Number(process.env.PORT ?? 8787);

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadHeroFonts()],
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@web": fileURLToPath(new URL("./src/web", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: `http://localhost:${serverPort}`, changeOrigin: true },
    },
  },
  build: { target: "es2022" },
});
