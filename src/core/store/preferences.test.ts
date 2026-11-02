import { describe, expect, it } from "vitest";
import { createPreferencesStore, preferencesStorageKey } from "./preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    storage: {
      getItem: (name: string) => data[name] ?? null,
      setItem: (name: string, value: string) => {
        data[name] = value;
      },
      removeItem: (name: string) => {
        delete data[name];
      },
    },
  };
}

describe("preferences store", () => {
  it("persists only language and elder mode", () => {
    const { data, storage } = memoryStorage();
    const store = createPreferencesStore(() => storage);
    store.getState().setLanguage("mr");
    store.getState().setElderMode(true);
    store.getState().setFastDemo(true);
    const saved = JSON.parse(data[preferencesStorageKey] ?? "{}") as { state: Record<string, unknown> };
    expect(saved.state).toEqual({ language: "mr", elderMode: true });
  });

  it("restores saved language and ignores invalid values", () => {
    const { storage } = memoryStorage({
      [preferencesStorageKey]: JSON.stringify({ state: { language: "xx", elderMode: true }, version: 0 }),
    });
    const store = createPreferencesStore(() => storage);
    expect(store.getState().language).toBe("en");
    expect(store.getState().elderMode).toBe(true);
  });

  it("keeps working when storage throws", () => {
    const store = createPreferencesStore(() => {
      throw new Error("blocked");
    });
    store.getState().setLanguage("hi");
    expect(store.getState().language).toBe("hi");
  });
});
