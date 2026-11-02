import { z } from "zod";
import { ApiError } from "./error";
import { requestJson } from "./http";
import type { ProfileUpdate } from "./schemas/backend";
import {
  accuracySchema,
  analyticsSchema,
  authResponseSchema,
  bestTimesSchema,
  bookingModesSchema,
  bookingSchema,
  consentSchema,
  dashboardDoctorsSchema,
  dashboardOverviewSchema,
  doctorSchema,
  emergencyResponseSchema,
  nearestEmergencySchema,
  matchResponseSchema,
  okSchema,
  preAlertsSchema,
  profileSchema,
  queueSchema,
  simulatorStatusSchema,
  staffQueueSchema,
  slotsResponseSchema,
  slotTakenSchema,
  swapCandidatesSchema,
  swapRequestSchema,
  tokenSchema,
  userSchema,
  type MatchRequest,
} from "./schemas";
import type { Profile } from "./schemas/backend";

export type BookingResult =
  | { kind: "booked"; booking: z.infer<typeof bookingSchema> }
  | { kind: "slot_taken"; nextFreeSlot: string };

export function newIdempotencyKey(): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const backend = {
  login: (phone: string, otp: string) => requestJson("/auth/login", { schema: authResponseSchema, body: { phone, otp } }),
  register: (phone: string, name?: string, otp?: string) => requestJson("/auth/register", { schema: authResponseSchema, body: { phone, name, otp } }),
  me: () => requestJson("/me", { schema: userSchema }),
  addProfile: (profile: Omit<Profile, "id">) => requestJson("/profiles", { schema: profileSchema, body: profile }),
  updateProfile: (profileId: string, update: ProfileUpdate) => requestJson(`/profiles/${profileId}`, { schema: profileSchema, method: "PUT", body: update }),

  consents: () => requestJson("/consent", { schema: z.object({ consents: z.array(consentSchema) }) }).then((result) => result.consents),
  setConsent: (purpose: z.infer<typeof consentSchema>["purpose"], granted: boolean) =>
    requestJson("/consent", { schema: consentSchema, body: { purpose, granted } }),
  revokeConsent: (id: string) => requestJson(`/consent/${id}`, { schema: okSchema, method: "DELETE" }),

  match: (request: MatchRequest) => requestJson("/match", { schema: matchResponseSchema, body: request }),
  doctor: (id: string) => requestJson(`/doctors/${id}`, { schema: doctorSchema }),
  bestTimes: (id: string) => requestJson(`/doctors/${id}/best-times`, { schema: bestTimesSchema }),
  slots: (id: string) => requestJson(`/doctors/${id}/slots`, { schema: slotsResponseSchema }),

  async book(request: { doctor_id: string; profile_id: string; slot_start: string; purpose?: string }, idempotencyKey = newIdempotencyKey()): Promise<BookingResult> {
    try {
      const booking = await requestJson("/bookings", {
        schema: bookingSchema,
        body: request,
        headers: { "Idempotency-Key": idempotencyKey },
      });
      return { kind: "booked", booking };
    } catch (error) {
      if (error instanceof ApiError && error.code === "slot_taken") {
        const parsed = slotTakenSchema.safeParse(error.details);
        if (parsed.success) return { kind: "slot_taken", nextFreeSlot: parsed.data.next_free_slot };
      }
      throw error;
    }
  },

  issueToken: (bookingId: string) => requestJson("/tokens", { schema: tokenSchema, body: { booking_id: bookingId } }),
  myTokens: () => requestJson("/tokens/mine", { schema: z.object({ tokens: z.array(tokenSchema) }) }).then((result) => result.tokens),
  token: (id: string) => requestJson(`/tokens/${id}`, { schema: tokenSchema }),
  callToken: (id: string) => requestJson(`/tokens/${id}/call`, { schema: tokenSchema, method: "POST", body: {} }),
  completeToken: (id: string) => requestJson(`/tokens/${id}/complete`, { schema: tokenSchema, method: "POST", body: {} }),
  queue: (doctorId: string) => requestJson(`/queue/${doctorId}`, { schema: queueSchema }),

  swapCandidates: (tokenId: string) => requestJson(`/tokens/${tokenId}/swap-candidates`, { schema: swapCandidatesSchema }),
  createSwap: (tokenId: string, toTokenId: string, message: string) =>
    requestJson(`/tokens/${tokenId}/swap-requests`, { schema: swapRequestSchema, body: { to_token_id: toTokenId, message } }),
  latestSwap: (tokenId: string) => requestJson(`/tokens/${tokenId}/swap-requests/latest`, { schema: swapRequestSchema }),
  incomingSwaps: () =>
    requestJson("/swap-requests/incoming", { schema: z.object({ requests: z.array(swapRequestSchema) }) }).then((result) => result.requests),
  acceptSwap: (id: string) => requestJson(`/swap-requests/${id}/accept`, { schema: swapRequestSchema, method: "POST", body: {} }),
  declineSwap: (id: string) => requestJson(`/swap-requests/${id}/decline`, { schema: swapRequestSchema, method: "POST", body: {} }),
  cancelSwap: (id: string) => requestJson(`/swap-requests/${id}`, { schema: swapRequestSchema, method: "DELETE" }),

  dashboard: {
    overview: () => requestJson("/dashboard/overview", { schema: dashboardOverviewSchema }),
    doctors: () => requestJson("/dashboard/doctors", { schema: dashboardDoctorsSchema }),
    queue: (doctorId: string) => requestJson(`/dashboard/doctors/${doctorId}/queue`, { schema: staffQueueSchema }),
    walkIn: (doctorId: string) => requestJson(`/dashboard/doctors/${doctorId}/walk-in`, { schema: staffQueueSchema, body: {} }),
    setBreak: (doctorId: string, onBreak: boolean) => requestJson(`/dashboard/doctors/${doctorId}/break`, { schema: staffQueueSchema, body: { on_break: onBreak } }),
    setDelay: (doctorId: string, minutes: number) => requestJson(`/dashboard/doctors/${doctorId}/delay`, { schema: staffQueueSchema, body: { delay_minutes: minutes } }),
    skipToken: (tokenId: string) => requestJson(`/tokens/${tokenId}/skip`, { schema: okSchema, body: {} }),
    analytics: () => requestJson("/dashboard/analytics", { schema: analyticsSchema }),
    accuracy: () => requestJson("/dashboard/analytics/accuracy", { schema: accuracySchema }),
    bookingModes: () => requestJson("/dashboard/booking-modes", { schema: bookingModesSchema }),
    preAlerts: () => requestJson("/dashboard/pre-alerts", { schema: preAlertsSchema }),
  },

  nearestEmergency: (lat: number, lng: number) => requestJson(`/emergency/nearest?lat=${lat}&lng=${lng}`, { schema: nearestEmergencySchema }),
  emergency: (request: { lat: number; lng: number; profile_id: string; summary: string }) =>
    requestJson("/emergency", { schema: emergencyResponseSchema, body: request }),

  simulator: {
    status: () => requestJson("/mock/simulator", { schema: simulatorStatusSchema }),
    replay: () => requestJson("/mock/simulator/replay", { schema: simulatorStatusSchema, method: "POST", body: {} }),
    stop: () => requestJson("/mock/simulator/stop", { schema: simulatorStatusSchema, method: "POST", body: {} }),
    reset: () => requestJson("/mock/simulator/reset", { schema: simulatorStatusSchema, method: "POST", body: {} }),
    setSpeed: (speed: number) => requestJson("/mock/simulator/speed", { schema: simulatorStatusSchema, method: "POST", body: { speed } }),
  },
};
