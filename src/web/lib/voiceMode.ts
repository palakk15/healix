import { useEffect, useSyncExternalStore } from "react";

export type VoiceMode = "live" | "mock" | "off" | "unknown";

let known: VoiceMode | null = null;
let pending: Promise<VoiceMode> | null = null;
const listeners = new Set<() => void>();

function publish(mode: VoiceMode | null): void {
  known = mode;
  for (const listener of listeners) listener();
}

function parseMode(payload: unknown): VoiceMode {
  if (typeof payload !== "object" || payload === null) return "unknown";
  const mode = (payload as { sarvam_mode?: unknown }).sarvam_mode;
  return mode === "live" || mode === "mock" || mode === "off" ? mode : "unknown";
}

export function getVoiceMode(): Promise<VoiceMode> {
  if (known) return Promise.resolve(known);
  pending ??= fetch("/api/meta")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload: unknown) => {
      const mode = parseMode(payload);
      if (mode !== "unknown") publish(mode);
      return mode;
    })
    .catch(() => "unknown" as const)
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function markVoiceUnavailable(): void {
  publish("off");
}

export function resetVoiceModeForTests(): void {
  pending = null;
  publish(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): VoiceMode => known ?? "unknown";

export function useVoiceMode(): VoiceMode {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "unknown" as const);

  useEffect(() => {
    void getVoiceMode();
  }, []);

  return mode;
}
