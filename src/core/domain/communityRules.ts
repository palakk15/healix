export type ContentProblem = "phone" | "email" | "link" | "dose";

const rules: Array<[ContentProblem, RegExp]> = [
  ["phone", /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/],
  ["email", /[\w.+-]+@[\w-]+\.[\w.]+/],
  ["link", /https?:\/\/|www\.|\b[\w-]+\.(?:com|in|org|net|io)\b/i],
  ["dose", /\b\d+(?:\.\d+)?\s?(?:mg|mcg|ml|iu|units?)\b|\b(?:\d+|one|two|three|four|five|half)\s?(?:tablets?|pills?|capsules?)\b/i],
];

export function findContentProblem(text: string): ContentProblem | null {
  return rules.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

export function timeAgoParts(thenMs: number, nowMs: number): { unit: "now" | "minutes" | "hours" | "days"; value: number } {
  const minutes = Math.max(Math.floor((nowMs - thenMs) / 60_000), 0);
  if (minutes < 1) return { unit: "now", value: 0 };
  if (minutes < 60) return { unit: "minutes", value: minutes };
  if (minutes < 60 * 24) return { unit: "hours", value: Math.floor(minutes / 60) };
  return { unit: "days", value: Math.floor(minutes / (60 * 24)) };
}

const adjectives = ["Calm", "Brave", "Gentle", "Bright", "Kind", "Steady", "Quiet", "Warm", "Patient", "Cheerful", "Wise", "Sunny"];
const animals = ["Heron", "Tiger", "Peacock", "Sparrow", "Elephant", "Lotus", "Maina", "Koel", "Deer", "Parrot", "Otter", "Crane"];

export function aliasFor(userId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const value = hash >>> 0;
  return `${adjectives[value % adjectives.length]} ${animals[Math.floor(value / adjectives.length) % animals.length]}`;
}
