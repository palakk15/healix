import type { Specialty } from "@core/domain/specialty";
import type { Rng } from "./rng";

export const focusAreas: Record<Specialty, string[]> = {
  "General Physician": ["seasonal fevers", "diabetes follow-up", "blood pressure care", "thyroid checks", "elder health reviews", "preventive health packages", "fatigue and weakness"],
  Cardiology: ["blood pressure and cholesterol", "heart failure follow-up", "chest discomfort assessment", "rhythm problems", "after-stent care", "echo and stress testing", "preventive cardiology"],
  Pulmonology: ["asthma and allergy", "COPD care", "chronic cough", "sleep apnoea", "breathing tests", "post-infection recovery"],
  Gastroenterology: ["acidity and reflux", "liver health", "irritable bowel", "endoscopy", "gluten and food intolerance", "gut infections"],
  Neurology: ["migraine and headache", "epilepsy care", "stroke recovery", "nerve pain", "memory concerns", "movement disorders"],
  Orthopedics: ["knee and hip pain", "sports injuries", "back and neck pain", "fracture care", "joint replacement review", "shoulder problems"],
  Dermatology: ["acne and scars", "eczema and rashes", "hair fall", "fungal infections", "pigmentation", "allergic skin reactions"],
  ENT: ["sinus trouble", "hearing checks", "throat and voice", "ear infections", "snoring", "child ENT care"],
  Ophthalmology: ["vision checks", "cataract review", "dry eye", "diabetic eye screening", "glaucoma follow-up", "children's eye care"],
  "Gynecology and Obstetrics": ["pregnancy care", "irregular cycles", "PCOS", "menopause support", "family planning", "fertility counselling"],
  Pediatrics: ["newborn care", "vaccination schedules", "growth and nutrition", "recurrent colds", "childhood allergies", "adolescent health"],
  Psychiatry: ["anxiety and stress", "low mood", "sleep problems", "student wellbeing", "late-life mental health", "habit and addiction support"],
  Urology: ["kidney stones", "prostate care", "urinary infections", "men's health", "bladder control", "stone prevention"],
  Endocrinology: ["diabetes management", "thyroid disorders", "weight and metabolism", "hormone imbalance", "bone health", "adolescent growth"],
  Nephrology: ["chronic kidney care", "dialysis planning", "kidney stones", "blood pressure and kidneys", "protein in urine", "transplant follow-up"],
  Dentistry: ["root canal care", "braces and aligners", "gum health", "children's dentistry", "dentures", "smile correction"],
};

const approaches = [
  "Known for explaining results in plain words and writing the plan down.",
  "Keeps visits unhurried and encourages families to bring questions.",
  "Prefers to start with simple measures before suggesting more tests.",
  "Often sees patients who travel from nearby towns and plans follow-ups to save trips.",
  "Likes to review old reports in detail before the visit begins.",
  "Takes extra time with first-time patients and elders.",
  "Focuses on lifestyle changes that fit a patient's daily routine.",
  "Works closely with the hospital's lab and imaging teams for same-day answers.",
  "Regularly runs awareness sessions for the neighbourhood.",
  "Known for a calm, step-by-step way of talking through options.",
];

const openers = [
  (years: number, hospital: string) => `Practising for ${years} years and now seeing patients at ${hospital}.`,
  (years: number, hospital: string) => `${hospital} is home to this doctor's clinic, built on ${years} years of experience.`,
  (years: number, hospital: string) => `With ${years} years behind them, they consult at ${hospital}.`,
  (years: number, hospital: string) => `A ${years}-year career, most recently at ${hospital}.`,
];

const newOpeners = [
  (hospital: string) => `Recently joined ${hospital} and building a practice.`,
  (hospital: string) => `Newly practising at ${hospital}, with fresh training in current guidelines.`,
];

export interface Bio {
  about: string;
  focus: string[];
}

export function bioFor(rng: Rng, specialty: Specialty, years: number, hospitalName: string, isNew: boolean): Bio {
  const pool = [...focusAreas[specialty]];
  const focus: string[] = [];
  const count = rng.int(2, 3);
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const picked = rng.int(0, pool.length - 1);
    focus.push(pool.splice(picked, 1)[0] ?? "");
  }
  const opener = isNew ? rng.pick(newOpeners)(hospitalName) : rng.pick(openers)(years, hospitalName);
  const interest = `Special interest in ${focus.slice(0, -1).join(", ")}${focus.length > 1 ? " and " : ""}${focus[focus.length - 1] ?? ""}.`;
  return { about: `${opener} ${interest} ${rng.pick(approaches)}`, focus };
}

export const fixedBios: Record<string, Bio> = {
  doc_meera: {
    about:
      "Sixteen years in digestive and liver care at Karve Road. Sees many first-time endoscopy patients and is known for explaining each step before it happens. Special interest in acidity and reflux, liver health and irritable bowel.",
    focus: ["acidity and reflux", "liver health", "irritable bowel"],
  },
  doc_arjun: {
    about:
      "Twenty-one years in heart care, with long follow-up relationships after stents and rhythm treatment. Prefers a thorough first visit with echo and a written plan. Special interest in after-stent care, heart failure and blood pressure.",
    focus: ["after-stent care", "heart failure follow-up", "blood pressure and cholesterol"],
  },
  doc_fatima: {
    about:
      "Fourteen years as a family physician with a large walk-in following. Quick, practical visits for fevers and everyday illness, with careful reviews for long-term conditions. Special interest in diabetes follow-up, elder health and seasonal fevers.",
    focus: ["diabetes follow-up", "elder health reviews", "seasonal fevers"],
  },
};
