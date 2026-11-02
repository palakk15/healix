export const arrivalBufferMinutes = 10;

export interface LeaveAdvice {
  leaveInMinutes: number;
  leaveByIso: string;
  arriveByIso: string;
  travelMinutes: number;
}

export function adviseLeaveTime(nowIso: string, predictedWaitMinutes: number, travelMinutes: number): LeaveAdvice {
  const nowMs = new Date(nowIso).getTime();
  const arriveByMs = nowMs + (predictedWaitMinutes - arrivalBufferMinutes) * 60_000;
  const leaveByMs = arriveByMs - travelMinutes * 60_000;
  return {
    leaveInMinutes: Math.max(Math.round((leaveByMs - nowMs) / 60_000), 0),
    leaveByIso: new Date(leaveByMs).toISOString(),
    arriveByIso: new Date(arriveByMs).toISOString(),
    travelMinutes,
  };
}
