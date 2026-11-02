import { bioFor, fixedBios } from "./bios";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { distanceKm } from "@core/domain/geo";
import { specialties, type Specialty } from "@core/domain/specialty";
import { createRng, type Rng } from "./rng";
import type { HistoryDay, ScheduleWindow, SeedDoctor, SeedHistory, SeedHospital, SeedPatient } from "./seed-types";

export const seedValue = 20261101;
export const historyAnchorDate = "2026-10-19";

export const sunitaHome = { lat: 18.5, lng: 73.8077 };

export const hospitals: SeedHospital[] = [
  { id: "hosp_karve", name: "Karve Road Care Clinic", locality: "Kothrud", lat: 18.5189, lng: 73.8077, has_emergency: true },
  { id: "hosp_aundh", name: "Aundh Greenleaf Hospital", locality: "Aundh", lat: 18.559, lng: 73.807, has_emergency: true },
  { id: "hosp_baner", name: "Baner Hills Medical Centre", locality: "Baner", lat: 18.559, lng: 73.7868, has_emergency: false },
  { id: "hosp_deccan", name: "Deccan Shivaji Polyclinic", locality: "Shivajinagar", lat: 18.5308, lng: 73.8475, has_emergency: true },
  { id: "hosp_hadapsar", name: "Hadapsar Riverside Hospital", locality: "Hadapsar", lat: 18.5089, lng: 73.926, has_emergency: false },
  { id: "hosp_viman", name: "Viman Nagar Orchid Clinic", locality: "Viman Nagar", lat: 18.5679, lng: 73.9143, has_emergency: false },
];

const specialtyCounts: Record<Specialty, number> = {
  "General Physician": 12,
  Cardiology: 5,
  Pulmonology: 4,
  Gastroenterology: 5,
  Neurology: 4,
  Orthopedics: 6,
  Dermatology: 6,
  ENT: 5,
  Ophthalmology: 5,
  "Gynecology and Obstetrics": 6,
  Pediatrics: 7,
  Psychiatry: 3,
  Urology: 3,
  Endocrinology: 4,
  Nephrology: 2,
  Dentistry: 3,
};

const baseFee: Record<Specialty, [number, number]> = {
  "General Physician": [300, 500],
  Cardiology: [800, 1500],
  Pulmonology: [600, 1000],
  Gastroenterology: [600, 1100],
  Neurology: [800, 1400],
  Orthopedics: [600, 1100],
  Dermatology: [500, 900],
  ENT: [400, 800],
  Ophthalmology: [400, 800],
  "Gynecology and Obstetrics": [500, 1000],
  Pediatrics: [400, 700],
  Psychiatry: [800, 1500],
  Urology: [700, 1200],
  Endocrinology: [700, 1300],
  Nephrology: [800, 1400],
  Dentistry: [300, 700],
};

const consultRange: Record<Specialty, [number, number]> = {
  "General Physician": [8, 12],
  Cardiology: [12, 20],
  Pulmonology: [10, 15],
  Gastroenterology: [10, 15],
  Neurology: [15, 20],
  Orthopedics: [10, 15],
  Dermatology: [8, 12],
  ENT: [8, 12],
  Ophthalmology: [10, 15],
  "Gynecology and Obstetrics": [12, 20],
  Pediatrics: [8, 12],
  Psychiatry: [18, 20],
  Urology: [10, 15],
  Endocrinology: [12, 18],
  Nephrology: [12, 18],
  Dentistry: [10, 18],
};

const qualifications: Record<Specialty, string[]> = {
  "General Physician": ["MBBS", "MBBS, MD (Medicine)"],
  Cardiology: ["MBBS, MD, DM (Cardiology)"],
  Pulmonology: ["MBBS, MD (Pulmonary Medicine)"],
  Gastroenterology: ["MBBS, MD, DM (Gastroenterology)"],
  Neurology: ["MBBS, MD, DM (Neurology)"],
  Orthopedics: ["MBBS, MS (Orthopaedics)"],
  Dermatology: ["MBBS, MD (Dermatology)"],
  ENT: ["MBBS, MS (ENT)"],
  Ophthalmology: ["MBBS, MS (Ophthalmology)"],
  "Gynecology and Obstetrics": ["MBBS, MS (Obstetrics and Gynaecology)"],
  Pediatrics: ["MBBS, MD (Paediatrics)"],
  Psychiatry: ["MBBS, MD (Psychiatry)"],
  Urology: ["MBBS, MS, MCh (Urology)"],
  Endocrinology: ["MBBS, MD, DM (Endocrinology)"],
  Nephrology: ["MBBS, MD, DM (Nephrology)"],
  Dentistry: ["BDS", "BDS, MDS"],
};

interface NameGroup {
  firstNames: string[];
  lastNames: string[];
  languages: (rng: Rng) => string[];
}

const nameGroups: NameGroup[] = [
  {
    firstNames: ["Meera", "Rohan", "Sneha", "Aniket", "Pooja", "Sandeep", "Vaishali", "Prasad", "Neha", "Omkar", "Swati", "Chinmay"],
    lastNames: ["Kulkarni", "Deshmukh", "Patil", "Joshi", "Pawar", "Jadhav", "Gokhale", "Bhosale", "Shinde", "Phadke", "Apte", "Gaikwad"],
    languages: () => ["Marathi", "Hindi", "English"],
  },
  {
    firstNames: ["Anil", "Priya", "Rakesh", "Sunita", "Vikram", "Anjali", "Manoj", "Kavita"],
    lastNames: ["Sharma", "Verma", "Gupta", "Mishra", "Tiwari", "Yadav", "Chauhan", "Agarwal"],
    languages: (rng) => (rng.chance(0.3) ? ["Hindi", "English", "Marathi"] : ["Hindi", "English"]),
  },
  {
    firstNames: ["Hiral", "Jignesh", "Nirav", "Dhara", "Kunal", "Bhumika"],
    lastNames: ["Shah", "Mehta", "Patel", "Desai", "Trivedi"],
    languages: () => ["Gujarati", "Hindi", "English"],
  },
  {
    firstNames: ["Arjun", "Lakshmi", "Venkat", "Ramya", "Srinivas", "Divya"],
    lastNames: ["Rao", "Reddy", "Naidu", "Raju"],
    languages: () => ["Telugu", "English", "Hindi"],
  },
  {
    firstNames: ["Ganesh", "Shruti", "Raghav", "Pavithra"],
    lastNames: ["Hegde", "Bhat", "Shetty", "Gowda"],
    languages: () => ["Kannada", "English", "Hindi"],
  },
  {
    firstNames: ["Subramaniam", "Kavya", "Arvind", "Deepa", "Rajesh", "Anitha"],
    lastNames: ["Iyer", "Nair", "Menon", "Krishnan", "Pillai"],
    languages: () => ["English", "Hindi"],
  },
  {
    firstNames: ["Soumya", "Ananya", "Debashis", "Tanushree"],
    lastNames: ["Banerjee", "Chatterjee", "Sen", "Mukherjee", "Das"],
    languages: () => ["English", "Hindi"],
  },
  {
    firstNames: ["Imran", "Zoya", "Farhan", "Nazia", "Sameer", "Rubina"],
    lastNames: ["Shaikh", "Khan", "Ansari", "Syed", "Qureshi"],
    languages: (rng) => (rng.chance(0.4) ? ["Urdu", "Hindi", "English", "Marathi"] : ["Urdu", "Hindi", "English"]),
  },
  {
    firstNames: ["Harpreet", "Simran", "Gurdeep", "Jaspreet"],
    lastNames: ["Singh", "Gill", "Kaur", "Bedi"],
    languages: () => ["Hindi", "English"],
  },
];

const weekdayTemplates: number[][] = [
  [1, 2, 3, 4, 5, 6],
  [1, 2, 3, 4, 5],
  [1, 3, 5, 6],
  [2, 4, 6, 0],
  [1, 2, 3, 4, 5, 6, 0],
];

const tokenLetters = "ABCDEFGHJKLMNPRSTUVWXYZ";

interface FixedDoctor {
  id: string;
  name: string;
  specialty: Specialty;
  hospital_id: string;
  languages: string[];
  fee_inr: number;
  rating: number;
  review_count: number;
  consult_minutes: number;
  observed_consult_minutes: number;
  token_prefix: string;
  room: string;
  years_experience: number;
  qualifications: string;
}

const fixedDoctors: FixedDoctor[] = [
  {
    id: "doc_meera",
    name: "Dr. Meera Kulkarni",
    specialty: "Gastroenterology",
    hospital_id: "hosp_karve",
    languages: ["Marathi", "Hindi", "English"],
    fee_inr: 700,
    rating: 4.8,
    review_count: 412,
    consult_minutes: 10,
    observed_consult_minutes: 7.8,
    token_prefix: "A",
    room: "Room 4",
    years_experience: 16,
    qualifications: "MBBS, MD, DM (Gastroenterology)",
  },
  {
    id: "doc_arjun",
    name: "Dr. Arjun Rao",
    specialty: "Cardiology",
    hospital_id: "hosp_karve",
    languages: ["Telugu", "English", "Hindi"],
    fee_inr: 1100,
    rating: 4.7,
    review_count: 530,
    consult_minutes: 15,
    observed_consult_minutes: 4.7,
    token_prefix: "C",
    room: "Room 2",
    years_experience: 21,
    qualifications: "MBBS, MD, DM (Cardiology)",
  },
  {
    id: "doc_fatima",
    name: "Dr. Fatima Shaikh",
    specialty: "General Physician",
    hospital_id: "hosp_karve",
    languages: ["Urdu", "Hindi", "Marathi", "English"],
    fee_inr: 400,
    rating: 4.6,
    review_count: 905,
    consult_minutes: 10,
    observed_consult_minutes: 4.4,
    token_prefix: "G",
    room: "Room 1",
    years_experience: 14,
    qualifications: "MBBS, MD (Medicine)",
  },
];

function scheduleFor(rng: Rng): ScheduleWindow[] {
  const days = rng.pick(weekdayTemplates);
  const start = rng.pick(["09:00", "09:30", "10:00"]);
  const end = rng.pick(["16:00", "17:00", "18:00"]);
  return days.map((day) => ({ day, start, end }));
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function generateDoctors(rng: Rng): SeedDoctor[] {
  const doctors: SeedDoctor[] = [];
  const usedNames = new Set(fixedDoctors.map((doctor) => doctor.name));

  for (const fixed of fixedDoctors) {
    doctors.push({
      id: fixed.id,
      name: fixed.name,
      specialty: fixed.specialty,
      qualifications: fixed.qualifications,
      years_experience: fixed.years_experience,
      hospital_id: fixed.hospital_id,
      languages: fixed.languages,
      fee_inr: fixed.fee_inr,
      rating: fixed.rating,
      review_count: fixed.review_count,
      consult_minutes: fixed.consult_minutes,
      observed_consult_minutes: fixed.observed_consult_minutes,
      popularity: 1.3,
      schedule: [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, start: "09:00", end: "17:00" })),
      on_leave: false,
      booking_mode: "optimistic",
      token_prefix: fixed.token_prefix,
      room: fixed.room,
      about: "",
      focus: [],
    });
  }

  const hospitalPool = hospitals.flatMap((hospital, index) => Array<string>(index < 3 ? 3 : 2).fill(hospital.id));
  let counter = 0;

  for (const specialty of specialties) {
    const alreadyFixed = fixedDoctors.filter((doctor) => doctor.specialty === specialty).length;
    for (let index = alreadyFixed; index < specialtyCounts[specialty]; index += 1) {
      let group = rng.pick(nameGroups);
      let name = "";
      for (let attempt = 0; attempt < 40; attempt += 1) {
        group = rng.pick(nameGroups);
        name = `Dr. ${rng.pick(group.firstNames)} ${rng.pick(group.lastNames)}`;
        if (!usedNames.has(name)) break;
      }
      if (usedNames.has(name)) name = `${name} ${counter}`;
      usedNames.add(name);

      let hospitalId = rng.pick(hospitalPool);
      if (specialty === "Gastroenterology" && hospitalId === "hosp_karve") hospitalId = "hosp_aundh";

      const [feeLow, feeHigh] = baseFee[specialty];
      const [consultLow, consultHigh] = consultRange[specialty];
      const consultMinutes = rng.int(consultLow, consultHigh);
      const isNew = counter % 13 === 5;
      const onLeave = counter % 16 === 7;

      doctors.push({
        id: `doc_${String(counter + 1).padStart(3, "0")}`,
        name,
        specialty,
        qualifications: rng.pick(qualifications[specialty]),
        years_experience: isNew ? rng.int(2, 4) : rng.int(5, 35),
        hospital_id: hospitalId,
        languages: group.languages(rng),
        fee_inr: roundTo(rng.int(feeLow, feeHigh), 50),
        rating: isNew ? null : Math.round(rng.float(3.6, 4.9) * 10) / 10,
        review_count: isNew ? 0 : rng.int(12, 800),
        consult_minutes: consultMinutes,
        observed_consult_minutes: Math.round(consultMinutes * rng.float(0.75, 1.15) * 10) / 10,
        popularity: Math.round(rng.float(0.6, 1.4) * 100) / 100,
        schedule: scheduleFor(rng),
        on_leave: onLeave,
        booking_mode: rng.chance(0.1) ? "pessimistic" : "optimistic",
        token_prefix: tokenLetters.charAt(rng.int(0, tokenLetters.length - 1)),
        room: `Room ${rng.int(1, 12)}`,
        about: "",
        focus: [],
      });
      counter += 1;
    }
  }

  return doctors;
}

const patientLocalities: Array<{ locality: string; lat: number; lng: number }> = [
  { locality: "Kothrud", lat: 18.5074, lng: 73.8077 },
  { locality: "Aundh", lat: 18.5586, lng: 73.8075 },
  { locality: "Baner", lat: 18.5642, lng: 73.7769 },
  { locality: "Shivajinagar", lat: 18.5314, lng: 73.8446 },
  { locality: "Hadapsar", lat: 18.5018, lng: 73.9258 },
  { locality: "Viman Nagar", lat: 18.5679, lng: 73.9143 },
];

const patientConditions = ["Hypertension", "Type 2 diabetes", "Asthma", "Hypothyroidism", "Arthritis"];

export function generatePatients(rng: Rng): SeedPatient[] {
  const patients: SeedPatient[] = [
    {
      id: "pat_sunita",
      phone: "9876500001",
      name: "Sunita Patil",
      language: "mr",
      locality: "Kothrud",
      lat: sunitaHome.lat,
      lng: sunitaHome.lng,
      profiles: [
        { id: "prof_self", name: "Sunita Patil", relation: "self", age: 58, sex: "female", conditions: ["Type 2 diabetes"], language: "mr", elder_mode: false },
        { id: "prof_aai", name: "Shanta Joshi", relation: "mother", age: 82, sex: "female", conditions: ["Hypertension"], language: "mr", elder_mode: true },
      ],
    },
  ];

  const languages = ["mr", "hi", "en", "hinglish", "mr", "hi"];
  const group = nameGroups[0];
  const extraGroups = nameGroups;

  for (let index = 0; index < 19; index += 1) {
    const nameGroup = index % 3 === 0 && group ? group : rng.pick(extraGroups);
    const home = rng.pick(patientLocalities);
    const name = `${rng.pick(nameGroup.firstNames)} ${rng.pick(nameGroup.lastNames)}`;
    const language = rng.pick(languages);
    const age = rng.int(19, 84);
    patients.push({
      id: `pat_${String(index + 2).padStart(2, "0")}`,
      phone: `98765${String(index + 2).padStart(5, "0")}`,
      name,
      language,
      locality: home.locality,
      lat: Math.round((home.lat + rng.float(-0.006, 0.006)) * 10000) / 10000,
      lng: Math.round((home.lng + rng.float(-0.006, 0.006)) * 10000) / 10000,
      profiles: [
        {
          id: `prof_${String(index + 2).padStart(2, "0")}_self`,
          name,
          relation: "self",
          age,
          sex: rng.chance(0.55) ? "female" : "male",
          conditions: rng.chance(0.5) ? [rng.pick(patientConditions)] : [],
          language,
          elder_mode: age > 70,
        },
      ],
    });
  }

  return patients;
}

function hourFactor(hour: number): number {
  const factors: Record<number, number> = { 9: 1.35, 10: 1.6, 11: 1.45, 12: 0.9, 13: 0.55, 14: 0.8, 15: 1.05, 16: 0.95 };
  return factors[hour] ?? 0.5;
}

function weekdayFactor(weekday: number): number {
  const factors: Record<number, number> = { 1: 1.55, 2: 1.1, 3: 1.0, 4: 1.0, 5: 0.95, 6: 0.85, 0: 0.5 };
  return factors[weekday] ?? 1;
}

export function generateHistory(doctors: SeedDoctor[], rng: Rng): SeedHistory {
  const anchor = new Date(`${historyAnchorDate}T00:00:00.000Z`);
  const activeDoctors = doctors.filter((doctor) => !doctor.on_leave);
  const spikeDays = new Set([3, 9]);
  const rawDays: Array<{
    date: string;
    weekday: number;
    hours: Array<{ hour: number; patients: number; actual: number; slotFormula: number; model: number }>;
  }> = [];

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(anchor.getTime() + offset * 86_400_000);
    const weekday = date.getUTCDay();
    const hours: Array<{ hour: number; patients: number; actual: number; slotFormula: number; model: number }> = [];

    for (let hour = 9; hour <= 16; hour += 1) {
      let patients = 0;
      let actualSum = 0;
      let slotSum = 0;
      let samples = 0;
      const spike = spikeDays.has(offset) && hour === 11 ? 1.8 : 1;

      for (const doctor of activeDoctors) {
        const arrivals = rng.poisson(1.0 * doctor.popularity * hourFactor(hour) * weekdayFactor(weekday) * spike);
        if (arrivals === 0) continue;
        const queueLength = arrivals + rng.int(0, 2);
        const rushDelay = hourFactor(hour) > 1.3 ? rng.float(8, 20) : rng.float(0, 5);
        const actual = queueLength * doctor.observed_consult_minutes * rng.float(0.92, 1.12) + rushDelay;
        patients += arrivals;
        actualSum += actual * arrivals;
        slotSum += queueLength * doctor.consult_minutes * arrivals;
        samples += arrivals;
      }

      const actualWait = samples > 0 ? actualSum / samples : 0;
      const slotFormula = samples > 0 ? slotSum / samples : 0;
      hours.push({ hour, patients, actual: actualWait, slotFormula, model: actualWait });
    }
    rawDays.push({ date: date.toISOString().slice(0, 10), weekday, hours });
  }

  const flatten = rawDays.flatMap((day) => day.hours.filter((hour) => hour.patients > 0));
  const modelSigma = 5.5;
  const noise = flatten.map(() => rng.normal(0, modelSigma));
  flatten.forEach((hour, index) => {
    hour.model = Math.max(hour.actual + (noise[index] ?? 0), 0);
  });

  const rawSimpleMae = flatten.reduce((sum, hour) => sum + Math.abs(hour.slotFormula - hour.actual), 0) / flatten.length;
  const blend = Math.min(9 / rawSimpleMae, 2.5);

  const days: HistoryDay[] = rawDays.map((day) => {
    const hours = day.hours.map((hour) => ({
      hour: hour.hour,
      patients: hour.patients,
      actual_wait: round1(hour.actual),
      model_prediction: round1(hour.model),
      simple_prediction: round1(hour.actual + blend * (hour.slotFormula - hour.actual)),
    }));
    const active = hours.filter((hour) => hour.patients > 0);
    return {
      date: day.date,
      weekday: day.weekday,
      hours,
      model_mae: round1(mean(active.map((hour) => Math.abs(hour.model_prediction - hour.actual_wait)))),
      simple_mae: round1(mean(active.map((hour) => Math.abs(hour.simple_prediction - hour.actual_wait)))),
    };
  });

  const allActive = days.flatMap((day) => day.hours.filter((hour) => hour.patients > 0));
  return {
    anchor_date: historyAnchorDate,
    days,
    model_mae: round1(mean(allActive.map((hour) => Math.abs(hour.model_prediction - hour.actual_wait)))),
    simple_mae: round1(mean(allActive.map((hour) => Math.abs(hour.simple_prediction - hour.actual_wait)))),
  };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function nearestFree(target: number, taken: Set<number>, low: number, high: number): number {
  for (let offset = 0; offset <= 120; offset += 10) {
    for (const candidate of [target + offset, target - offset]) {
      if (candidate >= low && candidate <= high && !taken.has(candidate)) return candidate;
    }
  }
  return target;
}

export function diversifyDoctors(doctors: SeedDoctor[], rng: Rng): SeedDoctor[] {
  const fixedIds = new Set(fixedDoctors.map((doctor) => doctor.id));
  const takenFees = new Set<number>(fixedDoctors.map((doctor) => doctor.fee_inr));
  const takenObserved = new Set<number>(fixedDoctors.map((doctor) => doctor.observed_consult_minutes));
  const hospitalNames = new Map(hospitals.map((hospital) => [hospital.id, hospital.name]));

  for (const doctor of doctors) {
    const hospitalName = hospitalNames.get(doctor.hospital_id) ?? "the hospital";
    if (fixedIds.has(doctor.id)) {
      const fixed = fixedBios[doctor.id];
      doctor.about = fixed?.about ?? "";
      doctor.focus = fixed?.focus ?? [];
      continue;
    }
    const [consultLow, consultHigh] = consultRange[doctor.specialty];
    doctor.consult_minutes = Math.min(20, Math.max(8, rng.int(consultLow - 1, consultHigh + 2)));
    doctor.fee_inr = nearestFree(roundTo(doctor.fee_inr + rng.int(-4, 4) * 10, 10), takenFees, 300, 1500);
    takenFees.add(doctor.fee_inr);
    let observed = Math.round(doctor.consult_minutes * rng.float(0.6, 1.2) * 10) / 10;
    while (takenObserved.has(observed)) observed = Math.round((observed + 0.1) * 10) / 10;
    takenObserved.add(observed);
    doctor.observed_consult_minutes = observed;
    if (doctor.rating !== null) doctor.review_count = Math.max(12, doctor.review_count + rng.int(-9, 9));
    const bio = bioFor(rng, doctor.specialty, doctor.years_experience, hospitalName, doctor.rating === null);
    doctor.about = bio.about;
    doctor.focus = bio.focus;
  }
  return doctors;
}

export function buildSeed() {
  const rng = createRng(seedValue);
  const doctors = diversifyDoctors(generateDoctors(rng), createRng(seedValue + 2));
  const patients = generatePatients(rng);
  const history = generateHistory(doctors, createRng(seedValue + 1));
  return { hospitals, doctors, patients, history };
}

export function demoDoctorDistanceKm(): number {
  const meera = hospitals.find((hospital) => hospital.id === "hosp_karve");
  return meera ? distanceKm(sunitaHome, meera) : 0;
}

function writeSeed(): void {
  const directory = resolve(dirname(fileURLToPath(import.meta.url)), "data");
  mkdirSync(directory, { recursive: true });
  const seed = buildSeed();
  for (const [name, value] of Object.entries(seed)) {
    writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  console.log(
    `seed written: ${seed.hospitals.length} hospitals, ${seed.doctors.length} doctors, ${seed.patients.length} patients, MAE model ${seed.history.model_mae} vs simple ${seed.history.simple_mae}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) writeSeed();
