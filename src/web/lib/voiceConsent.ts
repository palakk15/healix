import { sessionStore, useSession } from "../store";

export function useVoiceConsent(): boolean {
  return useSession((state) => state.consents.voice);
}

export function grantVoiceConsent(): void {
  const session = sessionStore.getState();
  session.setConsent("voice", true);
  if (session.role !== "patient") return;
  void import("@core/api/backend")
    .then(({ backend }) => backend.setConsent("voice", true))
    .catch(() => undefined);
}
