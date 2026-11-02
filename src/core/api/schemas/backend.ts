import { z } from "zod";
import { coordinatesSchema, isoDateTimeSchema, specialtySchema, urgencySchema } from "./common";

export const roleSchema = z.enum(["patient", "staff"]);

export const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  relation: z.enum(["self", "mother", "father", "spouse", "child", "other"]),
  age: z.number().int(),
  sex: z.enum(["female", "male", "other"]),
  conditions: z.array(z.string()),
  language: z.string(),
  elder_mode: z.boolean(),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(80),
  relation: z.enum(["mother", "father", "spouse", "child", "other"]).optional(),
  age: z.number().int().min(0).max(120),
  sex: z.enum(["female", "male", "other"]),
  conditions: z.array(z.string().max(60)).max(12),
  language: z.string(),
  elder_mode: z.boolean(),
});

export const userSchema = z.object({
  id: z.string(),
  role: roleSchema,
  name: z.string(),
  language: z.string(),
  home: coordinatesSchema.optional(),
  hospital_id: z.string().optional(),
  profiles: z.array(profileSchema),
});

export const authRequestSchema = z.object({
  phone: z.string().min(6),
  otp: z.string().optional(),
  name: z.string().optional(),
  role: roleSchema.optional(),
});

export const authResponseSchema = z.object({
  access_token: z.string(),
  user: userSchema,
});

export const consentPurposeSchema = z.enum(["triage", "reports", "location", "voice"]);

export const consentSchema = z.object({
  id: z.string(),
  purpose: consentPurposeSchema,
  granted: z.boolean(),
  updated_at: isoDateTimeSchema,
});

export const consentRequestSchema = z.object({ purpose: consentPurposeSchema, granted: z.boolean() });

export const hospitalSchema = z.object({
  id: z.string(),
  name: z.string(),
  locality: z.string(),
  lat: z.number(),
  lng: z.number(),
  has_emergency: z.boolean(),
});

export const doctorSchema = z.object({
  id: z.string(),
  name: z.string(),
  specialty: specialtySchema,
  qualifications: z.string(),
  years_experience: z.number().int(),
  hospital: hospitalSchema,
  languages: z.array(z.string()),
  fee_inr: z.number().int(),
  rating: z.number().min(0).max(5).nullable(),
  review_count: z.number().int().min(0),
  consult_minutes: z.number().int(),
  about: z.string().optional(),
  focus: z.array(z.string()).optional(),
  distance_km: z.number().optional(),
});

export const waitReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  minutes: z.number(),
});

export const predictedWaitSchema = z.object({
  wait_minutes: z.number(),
  range_low: z.number(),
  range_high: z.number(),
  reasons: z.array(waitReasonSchema),
  suggested_arrival: isoDateTimeSchema,
  source: z.string(),
});

export const matchRequestSchema = z.object({
  specialty: specialtySchema,
  urgency: urgencySchema,
  language: z.string(),
  lat: z.number(),
  lng: z.number(),
  max_fee: z.number().optional(),
  max_km: z.number().optional(),
});

export const matchItemSchema = z.object({
  doctor: doctorSchema,
  score: z.number(),
  why: z.string(),
  predicted_wait: predictedWaitSchema,
});

export const matchResponseSchema = z.object({
  items: z.array(matchItemSchema).max(5),
  server_time: isoDateTimeSchema,
});

export const bestTimesSchema = z.object({
  doctor_id: z.string(),
  times: z
    .array(z.object({ hour: z.number().int().min(0).max(23), label: z.string(), minutes_saved: z.number() }))
    .length(3),
});

export const slotSchema = z.object({
  start: isoDateTimeSchema,
  end: isoDateTimeSchema,
  available: z.boolean(),
});

export const slotsResponseSchema = z.object({
  doctor_id: z.string(),
  days: z.array(z.object({ date: z.string(), label: z.enum(["today", "tomorrow", "later"]), slots: z.array(slotSchema) })),
});

export const bookingRequestSchema = z.object({
  doctor_id: z.string(),
  profile_id: z.string(),
  slot_start: isoDateTimeSchema,
  purpose: z.string().max(60).optional(),
});

export const bookingSchema = z.object({
  booking_id: z.string(),
  doctor_id: z.string(),
  profile_id: z.string(),
  slot_start: isoDateTimeSchema,
  status: z.literal("confirmed"),
  purpose: z.string().optional(),
});

export const slotTakenSchema = z.object({
  error: z.object({ code: z.literal("slot_taken"), message: z.string(), retry: z.boolean() }),
  next_free_slot: isoDateTimeSchema,
});

export const tokenStatusSchema = z.enum(["waiting", "called", "completed", "cancelled"]);

export const tokenSchema = z.object({
  id: z.string(),
  label: z.string(),
  number: z.number().int(),
  doctor_id: z.string(),
  doctor_name: z.string(),
  hospital_name: z.string(),
  room: z.string(),
  purpose: z.string().optional(),
  profile_id: z.string().nullable(),
  status: tokenStatusSchema,
  issued_at: isoDateTimeSchema,
  now_serving: z.string().nullable(),
  ahead: z.number().int().min(0),
  travel_minutes: z.number(),
  predicted_wait: predictedWaitSchema,
  swap_requests_used: z.number().int().min(0),
  server_time: isoDateTimeSchema,
});

export const issueTokenRequestSchema = z.object({ booking_id: z.string() });

export const queueSchema = z.object({
  doctor_id: z.string(),
  now_serving: z.string().nullable(),
  next: z.array(z.object({ id: z.string(), label: z.string() })),
  length: z.number().int().min(0),
  delay_minutes: z.number(),
  status: z.enum(["running", "delayed", "break", "closed", "on_leave"]),
  booking_mode: z.enum(["optimistic", "pessimistic"]),
  server_time: isoDateTimeSchema,
});

export const swapStateSchema = z.enum(["pending", "accepted", "declined", "expired", "cancelled"]);

export const swapRequestSchema = z.object({
  id: z.string(),
  from_token: z.object({ id: z.string(), label: z.string() }),
  to_token: z.object({ id: z.string(), label: z.string() }),
  message: z.string(),
  state: swapStateSchema,
  created_at: isoDateTimeSchema,
  expires_at: isoDateTimeSchema,
  server_time: isoDateTimeSchema,
});

export const swapCreateRequestSchema = z.object({ to_token_id: z.string(), message: z.string().max(200) });

export const swapCandidatesSchema = z.object({
  candidates: z.array(z.object({ id: z.string(), label: z.string() })),
  requests_used: z.number().int(),
  max_requests: z.number().int(),
  has_pending: z.boolean(),
});

export const dashboardOverviewSchema = z.object({
  total_waiting: z.number().int(),
  average_wait_minutes: z.number(),
  busiest_doctor: z.object({ id: z.string(), name: z.string(), waiting: z.number().int() }).nullable(),
  server_time: isoDateTimeSchema,
});

export const dashboardDoctorSchema = z.object({
  doctor_id: z.string(),
  name: z.string(),
  specialty: specialtySchema,
  now_serving: z.string().nullable(),
  waiting: z.number().int(),
  predicted_wait_minutes: z.number(),
  status: z.enum(["running", "delayed", "break", "closed", "on_leave"]),
  next_token_id: z.string().nullable(),
  serving_token_id: z.string().nullable(),
  booking_mode: z.enum(["optimistic", "pessimistic"]),
});

export const dashboardDoctorsSchema = z.object({
  doctors: z.array(dashboardDoctorSchema),
  server_time: isoDateTimeSchema,
});

export const analyticsSchema = z.object({
  patients_per_hour: z.array(z.object({ hour: z.number().int(), label: z.string(), patients: z.number() })),
  predicted_vs_actual: z.array(
    z.object({ hour: z.number().int(), label: z.string(), predicted: z.number(), actual: z.number() }),
  ),
  synthetic: z.boolean(),
});

export const staffQueueSchema = z.object({
  doctor_id: z.string(),
  doctor_name: z.string(),
  specialty: specialtySchema,
  status: z.enum(["running", "delayed", "break", "closed", "on_leave"]),
  delay_minutes: z.number(),
  booking_mode: z.enum(["optimistic", "pessimistic"]),
  now_serving: z.string().nullable(),
  tokens: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      status: tokenStatusSchema,
      patient: z.string(),
      age: z.number().int().nullable(),
      purpose: z.string().optional(),
      issued_at: isoDateTimeSchema,
      waited_minutes: z.number(),
    }),
  ),
  server_time: isoDateTimeSchema,
});

export const accuracySchema = z.object({
  model_mae_minutes: z.number(),
  simple_mae_minutes: z.number(),
  daily: z.array(
    z.object({ date: z.string(), model_mae: z.number(), simple_mae: z.number() }),
  ),
  synthetic: z.boolean(),
});

export const bookingModeSchema = z.object({
  doctor_id: z.string(),
  name: z.string(),
  mode: z.enum(["optimistic", "pessimistic"]),
  slot_buffer_minutes: z.number(),
  predicted_wait_minutes: z.number(),
  reason: z.string(),
});

export const bookingModesSchema = z.object({
  modes: z.array(bookingModeSchema),
  server_time: isoDateTimeSchema,
});

export const emergencyRequestSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  profile_id: z.string(),
  summary: z.string(),
});

export const emergencyResponseSchema = z.object({
  alert_id: z.string(),
  hospital: hospitalSchema,
  eta_minutes: z.number(),
  received_at: isoDateTimeSchema,
});

export const nearestEmergencySchema = z.object({
  hospital: hospitalSchema,
  distance_km: z.number(),
  eta_minutes: z.number(),
});

export const preAlertSchema = z.object({
  id: z.string(),
  patient_label: z.string(),
  age: z.number().int(),
  summary: z.string(),
  eta_minutes: z.number(),
  received_at: isoDateTimeSchema,
});

export const preAlertsSchema = z.object({ alerts: z.array(preAlertSchema) });

export const simulatorStatusSchema = z.object({
  running: z.boolean(),
  mode: z.enum(["live", "replay"]),
  simulated_time: isoDateTimeSchema,
  progress: z.number().min(0).max(1),
  speed: z.number(),
});

export const eventTypeSchema = z.enum([
  "token_issued",
  "token_called",
  "token_completed",
  "swap_accepted",
  "doctor_delay",
  "emergency_prealert",
]);

export const queueEventSchema = z.object({
  type: eventTypeSchema,
  doctor_id: z.string().optional(),
  token_id: z.string().optional(),
  label: z.string().optional(),
  delay_minutes: z.number().optional(),
  token_ids: z.array(z.string()).optional(),
  at: isoDateTimeSchema,
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type NearestEmergency = z.infer<typeof nearestEmergencySchema>;
export type Profile = z.infer<typeof profileSchema>;
export type User = z.infer<typeof userSchema>;
export type Doctor = z.infer<typeof doctorSchema>;
export type Hospital = z.infer<typeof hospitalSchema>;
export type PredictedWait = z.infer<typeof predictedWaitSchema>;
export type MatchRequest = z.infer<typeof matchRequestSchema>;
export type MatchItem = z.infer<typeof matchItemSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type Queue = z.infer<typeof queueSchema>;
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export type QueueEvent = z.infer<typeof queueEventSchema>;
export type StaffQueue = z.infer<typeof staffQueueSchema>;
export type DashboardDoctor = z.infer<typeof dashboardDoctorSchema>;
export type ConsentRecord = z.infer<typeof consentSchema>;
export type SlotsResponse = z.infer<typeof slotsResponseSchema>;
export type SimulatorStatus = z.infer<typeof simulatorStatusSchema>;
