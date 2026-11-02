import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadEnv } from "./env";

describe("server meta", () => {
  it("reports mock mode and Sarvam disabled without a key", async () => {
    const app = createApp(loadEnv({}));
    const response = await app.request("/api/meta");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data_mode: "mock", sarvam_enabled: false, sarvam_mode: "mock", assistant_mode: "local" });
  });

  it("reports Sarvam enabled when a key is set and never leaks it", async () => {
    const app = createApp(loadEnv({ SARVAM_API_KEY: "secret-key", DATA_MODE: "live" }));
    const response = await app.request("/api/meta");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ data_mode: "live", sarvam_enabled: true, sarvam_mode: "live", assistant_mode: "local" });
    expect(text).not.toContain("secret-key");
  });

  it("returns the shared error shape for unknown API routes", async () => {
    const app = createApp(loadEnv({}));
    const response = await app.request("/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Unknown API route", retry: false } });
  });
});
