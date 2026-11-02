import { describe, expect, it } from "vitest";
import type { User } from "../api/schemas/backend";
import { activeProfile, createSessionStore, hasAnyConsent } from "./session";

const user: User = {
  id: "pat_1",
  role: "patient",
  name: "Sunita Patil",
  language: "mr",
  profiles: [
    { id: "p1", name: "Sunita Patil", relation: "self", age: 58, sex: "female", conditions: [], language: "mr", elder_mode: false },
    { id: "p2", name: "Shanta Joshi", relation: "mother", age: 82, sex: "female", conditions: [], language: "mr", elder_mode: true },
  ],
};

describe("session store", () => {
  it("starts signed out with nothing consented and no user", () => {
    const store = createSessionStore();
    expect(store.getState()).toMatchObject({ role: null, user: null, accessToken: null, activeProfileId: null });
    expect(hasAnyConsent(store.getState().consents)).toBe(false);
  });

  it("starts a session with the user, the token and the first profile active", () => {
    const store = createSessionStore();
    store.getState().startSession({ access_token: "mock.pat_1", user });
    expect(store.getState()).toMatchObject({ role: "patient", accessToken: "mock.pat_1", activeProfileId: "p1" });
    expect(activeProfile(store.getState())?.name).toBe("Sunita Patil");
  });

  it("switches the active profile and falls back to the first if the id is unknown", () => {
    const store = createSessionStore();
    store.getState().startSession({ access_token: "t", user });
    store.getState().setActiveProfile("p2");
    expect(activeProfile(store.getState())?.relation).toBe("mother");
    store.getState().setActiveProfile("nope");
    expect(activeProfile(store.getState())?.id).toBe("p1");
  });

  it("adds a family profile without touching the others", () => {
    const store = createSessionStore();
    store.getState().startSession({ access_token: "t", user });
    store.getState().addProfile({ id: "p3", name: "Baba", relation: "father", age: 85, sex: "male", conditions: [], language: "mr", elder_mode: true });
    expect(store.getState().user?.profiles.map((profile) => profile.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("replaces consents from the server and clears everything on sign out", () => {
    const store = createSessionStore();
    store.getState().startSession({ access_token: "t", user });
    store.getState().replaceConsents(["triage", "voice"]);
    expect(store.getState().consents).toEqual({ triage: true, reports: false, location: false, voice: true });
    store.getState().replaceConsents([]);
    expect(hasAnyConsent(store.getState().consents)).toBe(false);
    store.getState().setConsent("reports", true);
    store.getState().signOut();
    expect(store.getState()).toMatchObject({ role: null, user: null, accessToken: null });
    expect(hasAnyConsent(store.getState().consents)).toBe(false);
  });
});

describe("session persistence", () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      data,
      storage: {
        getItem: (name: string) => data.get(name) ?? null,
        setItem: (name: string, value: string) => void data.set(name, value),
        removeItem: (name: string) => void data.delete(name),
      },
    };
  }

  it("keeps only the token and the active profile id, never the person's profiles or health details", () => {
    const { data, storage } = memoryStorage();
    const store = createSessionStore(() => storage);
    store.getState().startSession({ access_token: "mock.pat_1", user: { ...user, profiles: [{ ...user.profiles[0]!, conditions: ["Type 2 diabetes"] }] } });
    store.getState().replaceConsents(["triage"]);
    const saved = data.get("healix.session") ?? "";
    expect(JSON.parse(saved).state).toEqual({ accessToken: "mock.pat_1", activeProfileId: "p1" });
    expect(saved).not.toMatch(/Sunita|diabetes|conditions|triage/);
  });

  it("restores the token and active profile in a new store, with no user until the server confirms", () => {
    const { storage } = memoryStorage();
    const first = createSessionStore(() => storage);
    first.getState().startSession({ access_token: "mock.pat_1", user });
    first.getState().setActiveProfile("p2");

    const second = createSessionStore(() => storage);
    expect(second.getState()).toMatchObject({ accessToken: "mock.pat_1", activeProfileId: "p2", user: null, role: null });
    second.getState().restoreUser(user);
    expect(second.getState()).toMatchObject({ role: "patient", activeProfileId: "p2" });
    expect(activeProfile(second.getState())?.relation).toBe("mother");
  });

  it("falls back to the first profile when the remembered one no longer exists", () => {
    const { storage } = memoryStorage();
    const first = createSessionStore(() => storage);
    first.getState().startSession({ access_token: "t", user });
    first.getState().setActiveProfile("gone");
    const second = createSessionStore(() => storage);
    second.getState().restoreUser(user);
    expect(second.getState().activeProfileId).toBe("p1");
  });

  it("forgets everything on sign out", () => {
    const { data, storage } = memoryStorage();
    const store = createSessionStore(() => storage);
    store.getState().startSession({ access_token: "t", user });
    store.getState().signOut();
    expect(JSON.parse(data.get("healix.session") ?? "{}").state).toEqual({ accessToken: null, activeProfileId: null });
    expect(createSessionStore(() => storage).getState().accessToken).toBeNull();
  });

  it("works when browser storage is blocked", () => {
    const store = createSessionStore(() => {
      throw new Error("blocked");
    });
    store.getState().startSession({ access_token: "t", user });
    expect(store.getState().accessToken).toBe("t");
  });

  it("ignores junk in storage", () => {
    const { storage, data } = memoryStorage();
    data.set("healix.session", JSON.stringify({ state: { accessToken: 42, activeProfileId: {} }, version: 0 }));
    expect(createSessionStore(() => storage).getState()).toMatchObject({ accessToken: null, activeProfileId: null });
  });
});
