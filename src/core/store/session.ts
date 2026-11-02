import { createStore, type StoreApi } from "zustand/vanilla";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { Profile, User } from "../api/schemas/backend";

export type Role = "patient" | "staff";

export const consentPurposes = ["triage", "reports", "location", "voice"] as const;

export type ConsentPurpose = (typeof consentPurposes)[number];

export type ConsentMap = Record<ConsentPurpose, boolean>;

export interface AuthPayload {
  access_token: string;
  user: User;
}

export interface SessionState {
  role: Role | null;
  user: User | null;
  accessToken: string | null;
  consents: ConsentMap;
  activeProfileId: string | null;
  startSession: (auth: AuthPayload) => void;
  restoreUser: (user: User) => void;
  signOut: () => void;
  setConsent: (purpose: ConsentPurpose, granted: boolean) => void;
  replaceConsents: (granted: ConsentPurpose[]) => void;
  setActiveProfile: (profileId: string) => void;
  addProfile: (profile: Profile) => void;
  replaceProfile: (profile: Profile) => void;
}

export type StorageProvider = () => StateStorage | undefined;

export const sessionStorageKey = "healix.session";

const noConsent: ConsentMap = { triage: false, reports: false, location: false, voice: false };

export function hasAnyConsent(consents: ConsentMap): boolean {
  return consentPurposes.some((purpose) => consents[purpose]);
}

export function activeProfile(state: Pick<SessionState, "user" | "activeProfileId">): Profile | null {
  const profiles = state.user?.profiles ?? [];
  return profiles.find((profile) => profile.id === state.activeProfileId) ?? profiles[0] ?? null;
}

function guarded(provider: StorageProvider): StateStorage {
  return {
    getItem: (name) => {
      try {
        return provider()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        provider()?.setItem(name, value);
      } catch {
        return;
      }
    },
    removeItem: (name) => {
      try {
        provider()?.removeItem(name);
      } catch {
        return;
      }
    },
  };
}

export function createSessionStore(provider?: StorageProvider): StoreApi<SessionState> {
  const initializer = (set: StoreApi<SessionState>["setState"]): SessionState => ({
    role: null,
    user: null,
    accessToken: null,
    consents: { ...noConsent },
    activeProfileId: null,
    startSession: (auth) =>
      set({
        role: auth.user.role,
        user: auth.user,
        accessToken: auth.access_token,
        activeProfileId: auth.user.profiles[0]?.id ?? null,
      }),
    restoreUser: (user) =>
      set((state) => ({
        role: user.role,
        user,
        activeProfileId: user.profiles.some((profile) => profile.id === state.activeProfileId) ? state.activeProfileId : (user.profiles[0]?.id ?? null),
      })),
    signOut: () => set({ role: null, user: null, accessToken: null, consents: { ...noConsent }, activeProfileId: null }),
    setConsent: (purpose, granted) => set((state) => ({ consents: { ...state.consents, [purpose]: granted } })),
    replaceConsents: (granted) => set({ consents: { ...noConsent, ...Object.fromEntries(granted.map((purpose) => [purpose, true])) } }),
    setActiveProfile: (activeProfileId) => set({ activeProfileId }),
    addProfile: (profile) => set((state) => (state.user ? { user: { ...state.user, profiles: [...state.user.profiles, profile] } } : state)),
    replaceProfile: (profile) =>
      set((state) =>
        state.user
          ? {
              user: {
                ...state.user,
                name: profile.relation === "self" ? profile.name : state.user.name,
                profiles: state.user.profiles.map((entry) => (entry.id === profile.id ? profile : entry)),
              },
            }
          : state,
      ),
  });

  if (!provider) return createStore<SessionState>()(initializer);

  return createStore<SessionState>()(
    persist(initializer, {
      name: sessionStorageKey,
      storage: createJSONStorage(() => guarded(provider)),
      partialize: (state) => ({ accessToken: state.accessToken, activeProfileId: state.activeProfileId }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<SessionState, "accessToken" | "activeProfileId">>;
        return {
          ...current,
          accessToken: typeof saved.accessToken === "string" ? saved.accessToken : null,
          activeProfileId: typeof saved.activeProfileId === "string" ? saved.activeProfileId : null,
        };
      },
    }),
  );
}
