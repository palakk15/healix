import type { Profile } from "@core/api/schemas/backend";
import { preferencesStore, sessionStore } from "../store";

export function selectProfile(profile: Profile): void {
  sessionStore.getState().setActiveProfile(profile.id);
  preferencesStore.getState().setElderMode(profile.elder_mode);
}
