const NARROW_SPACES = new RegExp("[" + String.fromCharCode(0x00a0) + String.fromCharCode(0x202f) + "]", "g");

const rupeeFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatRupees(amount: number): string {
  return `₹${rupeeFormatter.format(Math.round(amount))}`;
}

export const indiaTimeZone = "Asia/Kolkata";

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: indiaTimeZone,
});

export function formatIndiaTime(isoUtc: string | Date): string {
  const date = typeof isoUtc === "string" ? new Date(isoUtc) : isoUtc;
  return timeFormatter.format(date).replace(NARROW_SPACES, " ").toUpperCase();
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: indiaTimeZone,
});

export function formatIndiaDate(isoUtc: string | Date): string {
  const date = typeof isoUtc === "string" ? new Date(isoUtc) : isoUtc;
  return dateFormatter.format(date);
}

export function formatMinutes(minutes: number): string {
  return `${Math.round(minutes)} min`;
}

export function formatSignedMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}m`;
}
