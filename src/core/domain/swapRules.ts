export const maxSwapRequests = 3;
export const swapExpiryMinutes = 5;

export type SwapBlock = "called" | "limit" | "pending" | "nobody_ahead";

export interface SwapSituation {
  tokenStatus: "waiting" | "called" | "completed" | "cancelled";
  requestsUsed: number;
  hasPending: boolean;
  candidatesAhead: number;
}

export function swapBlockReason(situation: SwapSituation): SwapBlock | null {
  if (situation.tokenStatus !== "waiting") return "called";
  if (situation.requestsUsed >= maxSwapRequests) return "limit";
  if (situation.hasPending) return "pending";
  if (situation.candidatesAhead === 0) return "nobody_ahead";
  return null;
}

export function requestsLeft(used: number): number {
  return Math.max(maxSwapRequests - used, 0);
}
