export const delayAlertThresholdMinutes = 15;

export interface WaitChange {
  alert: boolean;
  deltaMinutes: number;
}

export function waitChange(initialMinutes: number, currentMinutes: number, threshold = delayAlertThresholdMinutes): WaitChange {
  const deltaMinutes = Math.round(currentMinutes - initialMinutes);
  return { alert: Math.abs(deltaMinutes) > threshold, deltaMinutes };
}
