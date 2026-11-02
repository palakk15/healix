import { describe, expect, it } from "vitest";
import { specialties } from "@core/domain/specialty";
import doctorsJson from "./data/doctors.json";
import historyJson from "./data/history.json";
import hospitalsJson from "./data/hospitals.json";
import patientsJson from "./data/patients.json";
import { buildSeed, demoDoctorDistanceKm } from "./generate";
import type { SeedDoctor } from "./seed-types";

const seed = buildSeed();
const doctors = seed.doctors as SeedDoctor[];

describe("seed dataset", () => {
  it("has 6 Pune hospitals in the named localities, with no real hospital names", () => {
    expect(seed.hospitals).toHaveLength(6);
    expect(seed.hospitals.map((hospital) => hospital.locality).sort()).toEqual(
      ["Aundh", "Baner", "Hadapsar", "Kothrud", "Shivajinagar", "Viman Nagar"].sort(),
    );
    for (const hospital of seed.hospitals) {
      expect(hospital.lat).toBeGreaterThan(18.4);
      expect(hospital.lat).toBeLessThan(18.7);
      expect(hospital.lng).toBeGreaterThan(73.7);
      expect(hospital.lng).toBeLessThan(74.0);
      expect(hospital.name).not.toMatch(/Ruby|Jehangir|Sahyadri|Deenanath|KEM|Aditya Birla|Jupiter|Noble/i);
    }
  });

  it("has 80 uniquely named doctors across all 16 specialties", () => {
    expect(doctors).toHaveLength(80);
    expect(new Set(doctors.map((doctor) => doctor.name)).size).toBe(80);
    expect(new Set(doctors.map((doctor) => doctor.id)).size).toBe(80);
    const covered = new Set(doctors.map((doctor) => doctor.specialty));
    expect(covered.size).toBeGreaterThanOrEqual(12);
    for (const specialty of specialties) expect(covered.has(specialty)).toBe(true);
  });

  it("keeps fees, ratings and consult times within the brief", () => {
    for (const doctor of doctors) {
      expect(doctor.fee_inr).toBeGreaterThanOrEqual(300);
      expect(doctor.fee_inr).toBeLessThanOrEqual(1500);
      expect(doctor.consult_minutes).toBeGreaterThanOrEqual(8);
      expect(doctor.consult_minutes).toBeLessThanOrEqual(20);
      if (doctor.rating !== null) {
        expect(doctor.rating).toBeGreaterThanOrEqual(3.6);
        expect(doctor.rating).toBeLessThanOrEqual(4.9);
      }
    }
  });

  it("includes new doctors without a rating, some on leave, and the minority languages", () => {
    expect(doctors.filter((doctor) => doctor.rating === null).length).toBeGreaterThanOrEqual(3);
    expect(doctors.filter((doctor) => doctor.on_leave).length).toBeGreaterThanOrEqual(3);
    const languages = new Set(doctors.flatMap((doctor) => doctor.languages));
    for (const language of ["Marathi", "Hindi", "English", "Gujarati", "Kannada", "Telugu", "Urdu"]) {
      expect(languages.has(language)).toBe(true);
    }
  });

  it("gives every specialty at least one doctor who is not on leave", () => {
    for (const specialty of specialties) {
      expect(doctors.some((doctor) => doctor.specialty === specialty && !doctor.on_leave)).toBe(true);
    }
  });

  it("has 20 patients including Sunita Patil with her mother's profile", () => {
    expect(seed.patients).toHaveLength(20);
    const sunita = seed.patients[0];
    expect(sunita).toMatchObject({ name: "Sunita Patil", language: "mr", locality: "Kothrud" });
    expect(sunita?.profiles[0]).toMatchObject({ age: 58, conditions: ["Type 2 diabetes"] });
    expect(sunita?.profiles[1]).toMatchObject({ relation: "mother", age: 82 });
    expect(new Set(seed.patients.map((patient) => patient.phone)).size).toBe(20);
  });

  it("puts the demo doctor 2.1 km from Sunita's home", () => {
    expect(demoDoctorDistanceKm()).toBeCloseTo(2.1, 1);
    const meera = doctors.find((doctor) => doctor.id === "doc_meera");
    expect(meera).toMatchObject({ specialty: "Gastroenterology", languages: expect.arrayContaining(["Marathi"]) });
    expect(doctors.filter((doctor) => doctor.specialty === "Gastroenterology" && doctor.hospital_id === "hosp_karve")).toHaveLength(1);
  });

  it("has 14 days of history with the model clearly beating the simple formula", () => {
    expect(seed.history.days).toHaveLength(14);
    expect(seed.history.model_mae).toBeGreaterThan(3);
    expect(seed.history.model_mae).toBeLessThan(5);
    expect(seed.history.simple_mae).toBeGreaterThan(8);
    expect(seed.history.simple_mae).toBeLessThan(10);
    const mondays = seed.history.days.filter((day) => day.weekday === 1);
    const sundays = seed.history.days.filter((day) => day.weekday === 0);
    const total = (days: typeof mondays) => days.reduce((sum, day) => sum + day.hours.reduce((inner, hour) => inner + hour.patients, 0), 0) / days.length;
    expect(total(mondays)).toBeGreaterThan(total(sundays));
    const hourTotals = (hour: number) => seed.history.days.reduce((sum, day) => sum + (day.hours.find((entry) => entry.hour === hour)?.patients ?? 0), 0);
    expect(hourTotals(10)).toBeGreaterThan(hourTotals(13));
  });

  it("is reproducible: two runs are identical and match the committed JSON", () => {
    expect(buildSeed()).toEqual(seed);
    expect(JSON.parse(JSON.stringify(seed.hospitals))).toEqual(hospitalsJson);
    expect(JSON.parse(JSON.stringify(seed.doctors))).toEqual(doctorsJson);
    expect(JSON.parse(JSON.stringify(seed.patients))).toEqual(patientsJson);
    expect(JSON.parse(JSON.stringify(seed.history))).toEqual(historyJson);
  });

  it("gives each doctor distinct fees, minutes and a bio of their own", () => {
    expect(new Set(doctors.map((doctor) => doctor.fee_inr)).size).toBeGreaterThanOrEqual(70);
    expect(new Set(doctors.map((doctor) => doctor.observed_consult_minutes)).size).toBe(80);
    expect(new Set(doctors.map((doctor) => doctor.about)).size).toBe(80);
    expect(new Set(doctors.map((doctor) => doctor.consult_minutes)).size).toBeGreaterThanOrEqual(8);
    for (const doctor of doctors) {
      expect(doctor.about.length).toBeGreaterThan(40);
      expect(doctor.focus.length).toBeGreaterThanOrEqual(2);
    }
  });
});
