import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/geist/wght.css";
import "@fontsource/geist-mono/latin-500.css";
import "@fontsource/mukta/devanagari-400.css";
import "@fontsource/mukta/devanagari-500.css";
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyFastDemoFromQuery, applyLanguageFromQuery } from "./store";
import { restoreSession, wireApi } from "./lib/auth";
import { prepareI18n, watchPreferences } from "./i18n";
import { App } from "./App";

applyLanguageFromQuery(window.location.search);
applyFastDemoFromQuery(window.location.search);
wireApi();

const container = document.getElementById("root");
if (!container) throw new Error("Root element is missing");

void Promise.all([prepareI18n(), restoreSession()]).then(() => {
  watchPreferences();
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
