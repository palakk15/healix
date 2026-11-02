export const specialties = [
  "General Physician",
  "Cardiology",
  "Pulmonology",
  "Gastroenterology",
  "Neurology",
  "Orthopedics",
  "Dermatology",
  "ENT",
  "Ophthalmology",
  "Gynecology and Obstetrics",
  "Pediatrics",
  "Psychiatry",
  "Urology",
  "Endocrinology",
  "Nephrology",
  "Dentistry",
] as const;

export type Specialty = (typeof specialties)[number];

export const urgencies = ["emergency", "urgent", "soon", "routine"] as const;

export type Urgency = (typeof urgencies)[number];

export function isSpecialty(value: unknown): value is Specialty {
  return typeof value === "string" && (specialties as readonly string[]).includes(value);
}
