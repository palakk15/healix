export function serverOffsetMs(serverTimeIso: string, receivedAtMs: number): number {
  return new Date(serverTimeIso).getTime() - receivedAtMs;
}

export function serverNowMs(offsetMs: number, nowMs: number): number {
  return nowMs + offsetMs;
}

export function minutesUntil(targetIso: string, offsetMs: number, nowMs: number): number {
  const remaining = new Date(targetIso).getTime() - serverNowMs(offsetMs, nowMs);
  return Math.max(Math.ceil(remaining / 60_000), 0);
}

export function secondsUntil(targetIso: string, offsetMs: number, nowMs: number): number {
  const remaining = new Date(targetIso).getTime() - serverNowMs(offsetMs, nowMs);
  return Math.max(Math.ceil(remaining / 1000), 0);
}

export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
