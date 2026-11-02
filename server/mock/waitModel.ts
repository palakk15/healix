import { arrivalBufferMinutes } from "@core/domain/leaveTime";

export interface WaitContext {
  aheadCount: number;
  observedConsultMinutes: number;
  delayMinutes: number;
  quickFollowUps: boolean;
  hour: number;
  weekday: number;
  nowIso: string;
}

export interface WaitReason {
  code: string;
  label: string;
  minutes: number;
}

export interface WaitPrediction {
  wait_minutes: number;
  range_low: number;
  range_high: number;
  reasons: WaitReason[];
  suggested_arrival: string;
  source: string;
}

export const rushStartsAtAhead = 4;
export const rushMinutes = 12;
export const quickFollowUpMinutes = 6;

export function predictWait(context: WaitContext): WaitPrediction {
  const base = context.aheadCount * context.observedConsultMinutes;
  const reasons: WaitReason[] = [];

  if (context.hour < 12 && context.aheadCount >= rushStartsAtAhead) {
    reasons.push({
      code: "morning_rush",
      label: context.weekday === 1 ? "Monday morning rush" : "Morning rush",
      minutes: rushMinutes,
    });
  }
  if (context.delayMinutes > 0) {
    reasons.push({ code: "doctor_late", label: "Doctor started late", minutes: Math.round(context.delayMinutes) });
  }
  if (context.quickFollowUps) {
    reasons.push({ code: "quick_followups", label: "Quick follow-ups ahead", minutes: -quickFollowUpMinutes });
  }

  const total = Math.max(Math.round(base + reasons.reduce((sum, reason) => sum + reason.minutes, 0)), 0);
  const spread = Math.max(3, Math.round(total * 0.12));
  const arrivalMs = new Date(context.nowIso).getTime() + (total - arrivalBufferMinutes) * 60_000;

  return {
    wait_minutes: total,
    range_low: Math.max(total - spread, 0),
    range_high: total + spread,
    reasons,
    suggested_arrival: new Date(arrivalMs).toISOString(),
    source: "mock-model",
  };
}
