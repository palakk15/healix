export const knownConditions = [
  { id: "Type 2 diabetes", key: "diabetes" },
  { id: "Hypertension", key: "hypertension" },
  { id: "Heart disease", key: "heart" },
  { id: "Asthma", key: "asthma" },
  { id: "Hypothyroidism", key: "thyroid" },
  { id: "Arthritis", key: "arthritis" },
  { id: "Kidney disease", key: "kidney" },
] as const;

export function conditionKey(id: string): string | null {
  return knownConditions.find((entry) => entry.id === id)?.key ?? null;
}

export function toggleCondition(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
}
