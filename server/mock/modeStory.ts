import type { Specialty } from "@core/domain/specialty";
import { istParts } from "@core/domain/time";
import type { DoctorStatus } from "./queue";
import type { SeedDoctor } from "./seed-types";

export interface ModeStoryInput {
  doctor: SeedDoctor;
  mode: "optimistic" | "pessimistic";
  status: DoctorStatus;
  waiting: number;
  predictedWait: number;
  delayMinutes: number;
  quickFollowUps: boolean;
  bufferMinutes: number;
  now: Date;
}

const specialtyNotes: Record<Specialty, [string, string]> = {
  "General Physician": ["General visits vary a lot, from a quick prescription to a long talk", "Walk-in style visits make this clinic hard to time"],
  Cardiology: ["ECG checks and test reviews stretch consultations", "Heart patients often need extra tests explained"],
  Pulmonology: ["Breathing tests and inhaler guidance add time to each visit", "Chest follow-ups tend to run longer than planned"],
  Gastroenterology: ["Diet counselling and scan reviews make visits run long", "Follow-ups after tests are detailed conversations"],
  Neurology: ["Detailed histories and examinations rarely finish early", "Each neurology visit needs a careful, unhurried check"],
  Orthopedics: ["Physical examinations and X-ray reviews add time", "Joint and spine checks need hands-on assessment"],
  Dermatology: ["Quick skin checks keep most visits short", "Many skin visits are brief follow-ups"],
  ENT: ["Short scope examinations keep the flow quick", "Ear and throat checks are brisk but frequent"],
  Ophthalmology: ["Eye tests need drops and waiting breaks", "Vision checks involve several quick stations"],
  "Gynecology and Obstetrics": ["Antenatal visits take a fixed, longer slot", "Examinations and counselling need privacy and time"],
  Pediatrics: ["Children's visits are short but unpredictable", "Parents often bring several questions, which adds minutes"],
  Psychiatry: ["Counselling sessions rarely finish early", "Conversations here are given room to breathe"],
  Urology: ["Procedure follow-ups and scan reviews vary in length", "Short checks mix with longer test discussions"],
  Endocrinology: ["Sugar and thyroid reviews mean long report discussions", "Regular follow-ups bring many reports to go through"],
  Nephrology: ["Kidney reports need careful explanation", "Dialysis and lab reviews make visits detailed"],
  Dentistry: ["Chair time varies with each procedure", "Quick checks sit beside longer procedures"],
};

const pessimisticLines = [
  "A {buffer}-minute gap is kept between slots so late arrivals do not pile up.",
  "Slots are spaced {buffer} minutes apart until waits settle below 25 minutes.",
  "Bookings are padded by {buffer} minutes because the queue has stayed above 35 minutes.",
  "Every slot carries a {buffer}-minute cushion to protect patients already waiting.",
];

const optimisticLines = [
  "Slots stay back to back because waits are under control.",
  "No padding is needed, the queue is moving at its usual pace.",
  "Bookings run back to back, and a cushion returns if waits pass 35 minutes.",
  "Patients are booked tightly because the room is clearing steadily.",
];

const factLines = [
  "{surname} averages {consult} min per patient with {waiting} waiting, about {wait} min for a new arrival.",
  "With {waiting} waiting and {consult} min per visit, a new arrival would wait about {wait} min.",
  "{waiting} {people} in the queue at {consult} min each puts the wait near {wait} min.",
  "At {consult} min a patient, today's line of {waiting} means roughly {wait} min.",
];

function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[seed % list.length] as T;
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

function surnameOf(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, "").split(/\s+/);
  return `Dr. ${parts[parts.length - 1] ?? name}`;
}

function windowToday(doctor: SeedDoctor, now: Date): string | null {
  const window = doctor.schedule.find((entry) => entry.day === istParts(now).weekday);
  return window ? `${window.start} to ${window.end}` : null;
}

export function modeStory(input: ModeStoryInput): string {
  const { doctor, mode, status, waiting, predictedWait, delayMinutes, quickFollowUps, bufferMinutes, now } = input;
  const seed = hash(doctor.id);
  const surname = surnameOf(doctor.name);

  if (status === "on_leave") return `${surname} is on leave today, so no new slots open. ${pick(specialtyNotes[doctor.specialty], seed)}, and booking returns when ${surname.replace("Dr. ", "Dr. ")} is back.`;
  if (status === "closed") {
    const hours = windowToday(doctor, now);
    return `${surname} is not in clinic right now${hours ? ` (today's hours are ${hours})` : ""}. ${pick(specialtyNotes[doctor.specialty], seed >>> 3)}, so ${mode === "pessimistic" ? `slots keep their ${bufferMinutes}-minute cushion` : "slots stay back to back"} when the next session opens.`;
  }

  const facts = fill(pick(factLines, seed >>> 2), {
    surname,
    consult: Math.round(doctor.observed_consult_minutes * 10) / 10,
    waiting,
    people: waiting === 1 ? "person is" : "people are",
    wait: predictedWait,
  });
  const note = `${pick(specialtyNotes[doctor.specialty], seed >>> 5)}.`;
  const decision = fill(pick(mode === "pessimistic" ? pessimisticLines : optimisticLines, seed >>> 7), { buffer: bufferMinutes });
  const extras: string[] = [];
  if (status === "break") extras.push(`${surname} is on a break at the moment.`);
  if (delayMinutes > 0) extras.push(`Running ${delayMinutes} min behind schedule.`);
  if (quickFollowUps) extras.push("Quick follow-ups are ahead, which should shorten the wait.");
  return [facts, note, decision, ...extras].join(" ");
}
