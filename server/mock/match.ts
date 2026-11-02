import { distanceKm, roundOneDecimal } from "@core/domain/geo";
import { formatClockLabel, istParts } from "@core/domain/time";
import type { MatchItem, MatchRequest } from "@core/api/schemas/backend";
import { isWorkingAt } from "./queue";
import { fnv1a, seedHistory, type MockWorld } from "./world";
import type { SeedDoctor } from "./seed-types";

const languageNames: Record<string, string> = { en: "English", hi: "Hindi", mr: "Marathi", hinglish: "Hindi" };

const weights = { rating: 0.22, distance: 0.22, language: 0.22, fee: 0.1, wait: 0.24 };
const defaultMaxKm = 15;
const maxFeeForScore = 1500;
const maxWaitForScore = 90;
const unratedAssumption = 4.0;
const topCount = 5;

interface Candidate {
  doctor: SeedDoctor;
  distance: number;
  wait: ReturnType<MockWorld["engine"]["predictForNewArrival"]>;
  speaksPatientLanguage: boolean;
  score: number;
}

function buildWhy(candidate: Candidate, languageName: string, shortestWait: number): string {
  const { doctor, wait, distance } = candidate;
  const parts: string[] = [];
  if (candidate.speaksPatientLanguage) parts.push(`speaks ${languageName}`);
  parts.push(`${roundOneDecimal(distance)} km away`);
  parts.push(wait.wait_minutes <= shortestWait ? `shortest wait at about ${wait.wait_minutes} min` : `about ${wait.wait_minutes} min wait`);
  parts.push(`${doctor.consult_minutes} min visits`);
  if (doctor.focus.length > 0) parts.push(`focus on ${doctor.focus[0]}`);
  parts.push(doctor.rating === null ? "new on Healix" : `rated ${doctor.rating.toFixed(1)} by ${doctor.review_count} patients`);
  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export function matchDoctors(world: MockWorld, request: MatchRequest): MatchItem[] {
  const origin = { lat: request.lat, lng: request.lng };
  const now = world.clock.now();
  const languageName = languageNames[request.language] ?? "English";
  const maxKm = request.max_km ?? defaultMaxKm;

  const pool = [...world.doctors.values()].filter((doctor) => doctor.specialty === request.specialty && !doctor.on_leave);
  const working = pool.filter((doctor) => isWorkingAt(doctor, now));
  const eligible = working.length > 0 ? working : pool;

  const candidates: Candidate[] = eligible
    .map((doctor) => {
      const hospital = world.hospitalOf(doctor);
      return {
        doctor,
        distance: distanceKm(origin, hospital),
        wait: world.engine.predictForNewArrival(doctor.id),
        speaksPatientLanguage: doctor.languages.includes(languageName),
        score: 0,
      };
    })
    .filter((candidate) => candidate.distance <= maxKm)
    .filter((candidate) => (request.max_fee === undefined ? true : candidate.doctor.fee_inr <= request.max_fee));

  const urgencyBoost = request.urgency === "urgent" || request.urgency === "emergency" ? 1.5 : 1;
  for (const candidate of candidates) {
    const ratingScore = (candidate.doctor.rating ?? unratedAssumption) / 5;
    const distanceScore = 1 - Math.min(candidate.distance / maxKm, 1);
    const languageScore = candidate.speaksPatientLanguage ? 1 : 0;
    const feeScore = 1 - Math.min(candidate.doctor.fee_inr / maxFeeForScore, 1);
    const waitScore = 1 - Math.min(candidate.wait.wait_minutes / maxWaitForScore, 1);
    candidate.score =
      weights.rating * ratingScore +
      weights.distance * distanceScore * urgencyBoost +
      weights.language * languageScore +
      weights.fee * feeScore +
      weights.wait * waitScore * urgencyBoost;
  }

  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, topCount);
  const shortestWait = Math.min(...ranked.map((entry) => entry.wait.wait_minutes));

  return ranked.map((candidate) => ({
    doctor: world.doctorView(candidate.doctor, candidate.distance),
    score: Math.round(candidate.score * 1000) / 1000,
    why: buildWhy(candidate, languageName, shortestWait),
    predicted_wait: candidate.wait,
  }));
}

const clinicHours = { start: 9, end: 17 };
const baselineConsultMinutes = 8;

function averageWaitByHour(): Map<number, number> {
  const totals = new Map<number, { sum: number; count: number }>();
  for (const day of seedHistory.days) {
    for (const hour of day.hours) {
      if (hour.patients === 0) continue;
      const entry = totals.get(hour.hour) ?? { sum: 0, count: 0 };
      entry.sum += hour.actual_wait;
      entry.count += 1;
      totals.set(hour.hour, entry);
    }
  }
  return new Map([...totals].map(([hour, entry]) => [hour, entry.sum / entry.count]));
}

function hourFactor(doctorId: string, hour: number): number {
  return 0.7 + ((fnv1a(`${doctorId}|hour|${hour}`) % 100) / 100) * 0.6;
}

export function bestTimes(world: MockWorld, doctorId: string) {
  const doctor = world.requireDoctor(doctorId);
  const averages = averageWaitByHour();
  const ratio = doctor.observed_consult_minutes / baselineConsultMinutes;
  const currentHour = Math.min(Math.max(istParts(world.clock.now()).hour, clinicHours.start), clinicHours.end - 1);
  const typicalNow = (averages.get(currentHour) ?? 0) * ratio * hourFactor(doctorId, currentHour);

  const options = [];
  for (let hour = clinicHours.start; hour < clinicHours.end; hour += 1) {
    if (hour === currentHour) continue;
    const typical = (averages.get(hour) ?? 0) * ratio * hourFactor(doctorId, hour);
    options.push({ hour, wait: typical, saved: Math.max(Math.round(typicalNow - typical), 0) });
  }
  const best = options.sort((a, b) => a.wait - b.wait).slice(0, 3).sort((a, b) => b.saved - a.saved);
  return {
    doctor_id: doctorId,
    times: best.map((entry) => ({ hour: entry.hour, label: formatClockLabel(entry.hour), minutes_saved: entry.saved })),
  };
}
