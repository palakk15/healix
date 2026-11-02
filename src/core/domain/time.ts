const istOffsetMinutes = 330;

export interface IstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

export function istParts(date: Date): IstParts {
  const shifted = new Date(date.getTime() + istOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export function istDateKey(date: Date): string {
  const parts = istParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function istMinutesOfDay(date: Date): number {
  const parts = istParts(date);
  return parts.hour * 60 + parts.minute;
}

export function istMidnightUtcMs(date: Date): number {
  const parts = istParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day) - istOffsetMinutes * 60_000;
}

export function istTimeToDate(dateKey: string, time: string): Date {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const [hourText, minuteText] = time.split(":");
  const utcMs =
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), Number(hourText), Number(minuteText)) -
    istOffsetMinutes * 60_000;
  return new Date(utcMs);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const base = istTimeToDate(dateKey, "12:00");
  return istDateKey(new Date(base.getTime() + days * 86_400_000));
}

export function formatClockLabel(hour: number, minute = 0): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}
