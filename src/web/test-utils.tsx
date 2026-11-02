import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { i18n } from "./i18n";
import { resetVoiceModeForTests } from "./lib/voiceMode";
import { preferencesStore, sessionStore } from "./store";

export function renderWithI18n(element: ReactElement) {
  const wrap = (child: ReactElement) => <I18nextProvider i18n={i18n}>{child}</I18nextProvider>;
  const view = render(wrap(element));
  return { ...view, rerender: (next: ReactElement) => view.rerender(wrap(next)) };
}

export function stubMeta(mode: "live" | "mock" | "off" | "missing" | "broken") {
  resetVoiceModeForTests();
  const fetchStub = (input: RequestInfo | URL) => {
    if (String(input) !== "/api/meta") return Promise.reject(new Error(`unexpected request ${String(input)}`));
    if (mode === "broken") return Promise.reject(new TypeError("offline"));
    const body = mode === "missing" ? { data_mode: "mock", sarvam_enabled: false } : { data_mode: "mock", sarvam_enabled: mode === "live", sarvam_mode: mode };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  return fetchStub;
}

export async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function resetStores() {
  sessionStore.getState().signOut();
  preferencesStore.setState({ language: "en", elderMode: false });
  document.documentElement.lang = "en";
}

export function renderWithProviders(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (child: ReactElement) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}><MemoryRouter>{child}</MemoryRouter></QueryClientProvider>
    </I18nextProvider>
  );
  const view = render(wrap(element));
  return { ...view, rerender: (next: ReactElement) => view.rerender(wrap(next)) };
}
