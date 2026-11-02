import type { Token } from "../api/schemas/backend";
import { predictedWait, tokenLabel, travelMinutes, type DemoQueueState } from "./demoQueue";

export const sampleTokenId = "sample";

export function sampleToken(state: DemoQueueState, nowMs: number): Token {
  const doctor = state.doctors[0];
  if (!doctor) throw new Error("The demo queue has no doctors");
  const ahead = doctor.waiting;
  const wait = predictedWait(doctor);
  const spread = Math.max(3, Math.round(wait * 0.12));
  return {
    id: sampleTokenId,
    label: tokenLabel(doctor, doctor.now + ahead + 1),
    number: doctor.now + ahead + 1,
    doctor_id: "sample_doctor",
    doctor_name: doctor.name,
    hospital_name: "Karve Road Care Clinic",
    room: "Room 4",
    purpose: "Sample visit",
    profile_id: null,
    status: "waiting",
    issued_at: new Date(nowMs - 6 * 60_000).toISOString(),
    now_serving: tokenLabel(doctor),
    ahead,
    travel_minutes: travelMinutes + 11,
    predicted_wait: {
      wait_minutes: wait,
      range_low: Math.max(wait - spread, 0),
      range_high: wait + spread,
      reasons: [
        { code: "morning_rush", label: "Morning rush", minutes: 12 },
        { code: "doctor_late", label: "Doctor started late", minutes: 8 },
        { code: "quick_followups", label: "Quick follow-ups ahead", minutes: -6 },
      ],
      suggested_arrival: new Date(nowMs + (wait - 10) * 60_000).toISOString(),
      source: "sample",
    },
    swap_requests_used: 0,
    server_time: new Date(nowMs).toISOString(),
  };
}
