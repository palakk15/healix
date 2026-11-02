import { distanceKm, roundOneDecimal, travelMinutesByAuto } from "@core/domain/geo";
import { istDateKey, istParts, istTimeToDate, addDaysToDateKey, formatClockLabel } from "@core/domain/time";
import type {
  Doctor,
  Hospital,
  Profile,
  Token,
  User,
  Queue,
  StaffQueue,
  SwapRequest,
} from "@core/api/schemas/backend";
import type { z } from "zod";
import type { bookingSchema, consentSchema, slotsResponseSchema } from "@core/api/schemas/backend";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createMockClock, type MockClock, type MockClockOptions } from "./clock";
import doctorsData from "./data/doctors.json";
import historyData from "./data/history.json";
import hospitalsData from "./data/hospitals.json";
import patientsData from "./data/patients.json";
import { MockError } from "./errors";
import { QueueEngine, standardSlotMinutes, tokenLabel, type EngineSnapshot, type EngineToken, type QueueEventPayload } from "./queue";
import { createRng } from "./rng";
import { CommunityStore, type CommunitySnapshot } from "./community";
import { ReportStore, type ReportStoreSnapshot } from "./reports";
import type { SeedDoctor, SeedHistory, SeedHospital, SeedPatient } from "./seed-types";
import type { TriageSession } from "./triage";

export type BookingRecord = z.infer<typeof bookingSchema>;
export type ConsentRecord = z.infer<typeof consentSchema>;
export type SlotsPayload = z.infer<typeof slotsResponseSchema>;

export interface SwapRecord {
  id: string;
  fromTokenId: string;
  toTokenId: string;
  fromLabel: string;
  toLabel: string;
  message: string;
  state: SwapRequest["state"];
  createdAtMs: number;
  expiresAtMs: number;
  autoResolveAtMs: number | null;
}

export interface PreAlertRecord {
  id: string;
  hospitalId: string;
  patientLabel: string;
  age: number;
  summary: string;
  etaMinutes: number;
  receivedAt: string;
}

export interface StaffAccount {
  phone: string;
  hospitalId: string;
  name?: string;
}

export interface WorldOptions extends MockClockOptions {
  rngSeed?: number;
  clock?: MockClock;
  mode?: "demo" | "local";
  tokenSecret?: string;
  tokenLifetimeMs?: number;
  staff?: StaffAccount[];
  uploadDirectory?: string;
}

export interface WorldSnapshot {
  version: 1;
  patients: SeedPatient[];
  consents: Array<[string, ConsentRecord[]]>;
  bookings: BookingRecord[];
  bookingTokens: Array<[string, string]>;
  slotsTaken: string[];
  idempotency: Array<[string, { status: number; body: unknown }]>;
  swaps: SwapRecord[];
  counters: { swap: number; booking: number; alert: number; extraPatient: number };
  alerts: PreAlertRecord[];
  engine: EngineSnapshot;
  reports: ReportStoreSnapshot;
  community?: CommunitySnapshot;
}

const defaultStaff: StaffAccount[] = [{ phone: "9000000001", hospitalId: "hosp_karve", name: "Front desk, Karve Road" }];

export const maxSwapRequests = 3;
export const swapExpiryMs = 5 * 60_000;
export const swapAutoResolveMs = 25_000;
export const swapAutoResolveFastMs = 3_000;
export const demoSlotMinutes = standardSlotMinutes;

const seedHospitals = hospitalsData as SeedHospital[];
const seedDoctors = doctorsData as SeedDoctor[];
const seedPatients = patientsData as SeedPatient[];
export const seedHistory = historyData as SeedHistory;

export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hospitalView(hospital: SeedHospital): Hospital {
  return { ...hospital };
}

export class MockWorld {
  readonly clock: MockClock;
  readonly engine: QueueEngine;
  readonly reports: ReportStore;
  readonly community: CommunityStore;
  readonly hospitals = new Map(seedHospitals.map((hospital) => [hospital.id, hospital]));
  readonly doctors = new Map(seedDoctors.map((doctor) => [doctor.id, doctor]));
  readonly patients = new Map<string, SeedPatient>();
  readonly triageSessions = new Map<string, TriageSession>();
  readonly alerts: PreAlertRecord[] = [];
  private readonly consents = new Map<string, Map<string, ConsentRecord>>();
  private readonly bookings = new Map<string, BookingRecord>();
  private readonly bookingTokens = new Map<string, string>();
  private readonly slotsTaken = new Set<string>();
  private readonly idempotency = new Map<string, { status: number; body: unknown }>();
  private readonly swaps = new Map<string, SwapRecord>();
  private swapCounter = 0;
  private bookingCounter = 0;
  private alertCounter = 0;
  private raceDone = false;
  private rushDone = false;
  private incomingPlan: { fromTokenId: string; toTokenId: string; dueAtMs: number; created: boolean } | null = null;
  private readonly profileOwners = new Map<string, string>();
  private extraPatientCounter = 0;
  readonly demo: boolean;
  private readonly tokenSecret: string | undefined;
  private readonly tokenLifetimeMs: number;
  private readonly staffAccounts: StaffAccount[];

  constructor(options: WorldOptions = {}) {
    this.demo = (options.mode ?? "demo") === "demo";
    this.tokenSecret = options.tokenSecret;
    this.tokenLifetimeMs = options.tokenLifetimeMs ?? 12 * 3_600_000;
    this.staffAccounts = options.staff ?? defaultStaff;
    this.clock = options.clock ?? createMockClock(options);
    this.engine = new QueueEngine(seedDoctors, this.clock, createRng(options.rngSeed ?? 7), {
      empty: !this.demo,
      learnConsultTimes: !this.demo,
    });
    this.reports = new ReportStore(this.clock, { seedHistory: this.demo, uploadDirectory: options.uploadDirectory });
    this.community = new CommunityStore(this.clock);
    this.restorePatients();
  }

  private restorePatients(): void {
    this.patients.clear();
    this.profileOwners.clear();
    if (this.demo) {
      for (const patient of structuredClone(seedPatients)) {
        this.patients.set(patient.id, patient);
        this.indexProfiles(patient);
      }
    }
    this.extraPatientCounter = 0;
  }

  snapshot(): WorldSnapshot {
    return {
      version: 1,
      patients: structuredClone([...this.patients.values()]),
      consents: [...this.consents].map(([userId, bucket]) => [userId, [...bucket.values()]]),
      bookings: [...this.bookings.values()],
      bookingTokens: [...this.bookingTokens],
      slotsTaken: [...this.slotsTaken],
      idempotency: [...this.idempotency],
      swaps: [...this.swaps.values()],
      counters: { swap: this.swapCounter, booking: this.bookingCounter, alert: this.alertCounter, extraPatient: this.extraPatientCounter },
      alerts: [...this.alerts],
      engine: this.engine.snapshot(),
      reports: this.reports.snapshot(),
      community: this.community.snapshot(),
    };
  }

  restore(snapshot: WorldSnapshot): void {
    this.patients.clear();
    this.profileOwners.clear();
    for (const patient of snapshot.patients) {
      this.patients.set(patient.id, patient);
      this.indexProfiles(patient);
    }
    this.consents.clear();
    for (const [userId, records] of snapshot.consents) this.consents.set(userId, new Map(records.map((record) => [record.purpose, record])));
    this.bookings.clear();
    for (const booking of snapshot.bookings) this.bookings.set(booking.booking_id, booking);
    this.bookingTokens.clear();
    for (const [bookingId, tokenId] of snapshot.bookingTokens) this.bookingTokens.set(bookingId, tokenId);
    this.slotsTaken.clear();
    for (const key of snapshot.slotsTaken) this.slotsTaken.add(key);
    this.idempotency.clear();
    for (const [key, value] of snapshot.idempotency) this.idempotency.set(key, value);
    this.swaps.clear();
    for (const swap of snapshot.swaps) this.swaps.set(swap.id, swap);
    this.swapCounter = snapshot.counters.swap;
    this.bookingCounter = snapshot.counters.booking;
    this.alertCounter = snapshot.counters.alert;
    this.extraPatientCounter = snapshot.counters.extraPatient;
    this.alerts.length = 0;
    this.alerts.push(...snapshot.alerts);
    this.engine.restore(snapshot.engine);
    this.reports.restore(snapshot.reports);
    if (snapshot.community) this.community.restore(snapshot.community);
  }

  private indexProfiles(patient: SeedPatient): void {
    for (const profile of patient.profiles) this.profileOwners.set(profile.id, patient.id);
  }

  resetDemoState(): void {
    this.bookings.clear();
    this.bookingTokens.clear();
    this.slotsTaken.clear();
    this.idempotency.clear();
    this.swaps.clear();
    this.alerts.length = 0;
    this.triageSessions.clear();
    this.consents.clear();
    this.raceDone = false;
    this.rushDone = false;
    this.incomingPlan = null;
    this.restorePatients();
    this.clock.reset();
    this.engine.reset({ empty: !this.demo });
    this.reports.reset();
    this.community.reset();
  }

  nowIso(): string {
    return this.clock.now().toISOString();
  }

  private staffUserFor(account: StaffAccount): User {
    return {
      id: `staff_${account.hospitalId.replace(/^hosp_/, "")}_${account.phone.slice(-4)}`,
      role: "staff",
      name: account.name ?? "Front desk",
      language: "en",
      hospital_id: account.hospitalId,
      profiles: [],
    };
  }

  staffUser(): User {
    const account = this.staffAccounts[0];
    if (!account) throw new MockError(404, "user_not_found", "No staff accounts are set up", false);
    return this.staffUserFor(account);
  }

  patientUser(patient: SeedPatient): User {
    return {
      id: patient.id,
      role: "patient",
      name: patient.name,
      language: patient.language,
      home: { lat: patient.lat, lng: patient.lng },
      profiles: patient.profiles,
    };
  }

  findUserByPhone(phone: string): User | undefined {
    const staff = this.staffAccounts.find((account) => account.phone === phone);
    if (staff) return this.staffUserFor(staff);
    const patient = [...this.patients.values()].find((entry) => entry.phone === phone);
    return patient ? this.patientUser(patient) : undefined;
  }

  registerPatient(phone: string, name: string | undefined): User {
    this.extraPatientCounter += 1;
    const id = `pat_new_${this.extraPatientCounter}`;
    const profile: Profile = {
      id: `prof_${id}`,
      name: name ?? "New patient",
      relation: "self",
      age: 40,
      sex: "female",
      conditions: [],
      language: "en",
      elder_mode: false,
    };
    const patient: SeedPatient = {
      id,
      phone,
      name: name ?? "New patient",
      language: "en",
      locality: "Kothrud",
      lat: 18.5,
      lng: 73.8077,
      profiles: [profile],
    };
    this.patients.set(id, patient);
    this.indexProfiles(patient);
    return this.patientUser(patient);
  }

  userFromAuthorization(header: string | undefined): User | undefined {
    const token = header?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return undefined;
    const userId = this.tokenSecret ? this.verifySignedToken(token) : token.startsWith("mock.") ? token.slice("mock.".length) : undefined;
    if (!userId) return undefined;
    const staff = this.staffAccounts.map((account) => this.staffUserFor(account)).find((entry) => entry.id === userId);
    if (staff) return staff;
    const patient = this.patients.get(userId);
    return patient ? this.patientUser(patient) : undefined;
  }

  accessTokenFor(user: User): string {
    if (!this.tokenSecret) return `mock.${user.id}`;
    const payload = Buffer.from(JSON.stringify({ sub: user.id, exp: Date.now() + this.tokenLifetimeMs })).toString("base64url");
    const signature = createHmac("sha256", this.tokenSecret).update(payload).digest("base64url");
    return `v1.${payload}.${signature}`;
  }

  private verifySignedToken(token: string): string | undefined {
    const [version, payload, signature] = token.split(".");
    if (version !== "v1" || !payload || !signature || !this.tokenSecret) return undefined;
    const expected = createHmac("sha256", this.tokenSecret).update(payload).digest("base64url");
    const given = Buffer.from(signature);
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return undefined;
    try {
      const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
      if (typeof parsed.sub !== "string" || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return undefined;
      return parsed.sub;
    } catch {
      return undefined;
    }
  }

  ownerOfProfile(profileId: string | null): SeedPatient | undefined {
    if (!profileId) return undefined;
    const ownerId = this.profileOwners.get(profileId);
    return ownerId ? this.patients.get(ownerId) : undefined;
  }

  addProfile(user: User, profile: Omit<Profile, "id">): Profile {
    const patient = this.patients.get(user.id);
    if (!patient) throw new MockError(403, "forbidden", "Only patients have profiles");
    const created: Profile = { ...profile, id: `prof_${patient.id}_${patient.profiles.length + 1}` };
    patient.profiles.push(created);
    this.profileOwners.set(created.id, patient.id);
    return created;
  }

  updateProfile(user: User, profileId: string, update: Omit<Profile, "id" | "relation"> & { relation?: Profile["relation"] }): Profile {
    const patient = this.patients.get(user.id);
    const index = patient?.profiles.findIndex((entry) => entry.id === profileId) ?? -1;
    const current = patient?.profiles[index];
    if (!patient || !current) throw new MockError(404, "profile_not_found", "Profile not found");
    const isSelf = current.relation === "self";
    const next: Profile = {
      ...current,
      name: update.name.trim(),
      age: update.age,
      sex: update.sex,
      conditions: update.conditions,
      language: update.language,
      elder_mode: update.elder_mode,
      relation: isSelf ? "self" : (update.relation ?? current.relation),
    };
    patient.profiles[index] = next;
    if (isSelf) patient.name = next.name;
    return next;
  }

  listConsents(userId: string): ConsentRecord[] {
    return [...(this.consents.get(userId)?.values() ?? [])];
  }

  setConsent(userId: string, purpose: ConsentRecord["purpose"], granted: boolean): ConsentRecord {
    const bucket = this.consents.get(userId) ?? new Map<string, ConsentRecord>();
    const record: ConsentRecord = {
      id: bucket.get(purpose)?.id ?? `consent_${userId}_${purpose}`,
      purpose,
      granted,
      updated_at: this.nowIso(),
    };
    bucket.set(purpose, record);
    this.consents.set(userId, bucket);
    return record;
  }

  deleteConsent(userId: string, consentId: string): boolean {
    const bucket = this.consents.get(userId);
    if (!bucket) return false;
    for (const [purpose, record] of bucket) {
      if (record.id === consentId) {
        bucket.delete(purpose);
        return true;
      }
    }
    return false;
  }

  requireDoctor(doctorId: string): SeedDoctor {
    const doctor = this.doctors.get(doctorId);
    if (!doctor) throw new MockError(404, "doctor_not_found", "Doctor not found");
    return doctor;
  }

  hospitalOf(doctor: SeedDoctor): SeedHospital {
    const hospital = this.hospitals.get(doctor.hospital_id);
    if (!hospital) throw new Error(`Hospital missing for ${doctor.id}`);
    return hospital;
  }

  doctorView(doctor: SeedDoctor, distance?: number): Doctor {
    return {
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      qualifications: doctor.qualifications,
      years_experience: doctor.years_experience,
      hospital: hospitalView(this.hospitalOf(doctor)),
      languages: doctor.languages,
      fee_inr: doctor.fee_inr,
      rating: doctor.rating,
      review_count: doctor.review_count,
      consult_minutes: doctor.consult_minutes,
      about: doctor.about,
      focus: doctor.focus,
      ...(distance !== undefined ? { distance_km: roundOneDecimal(distance) } : {}),
    };
  }

  private isSlotTaken(doctorId: string, startIso: string): boolean {
    if (this.slotsTaken.has(`${doctorId}|${startIso}`)) return true;
    if (!this.demo) return false;
    if (doctorId === "doc_meera" || doctorId === "doc_arjun" || doctorId === "doc_fatima") {
      return fnv1a(`${doctorId}|${startIso}`) % 100 < 20;
    }
    return fnv1a(`${doctorId}|${startIso}`) % 100 < 35;
  }

  slotsFor(doctorId: string): SlotsPayload {
    const doctor = this.requireDoctor(doctorId);
    const now = this.clock.now();
    const todayKey = istDateKey(now);
    const days = ([0, 1, 2, 3, 4, 5, 6] as const).map((offset) => {
      const dateKey = addDaysToDateKey(todayKey, offset);
      const weekday = istParts(istTimeToDate(dateKey, "12:00")).weekday;
      const window = doctor.schedule.find((entry) => entry.day === weekday);
      const slots: SlotsPayload["days"][number]["slots"] = [];
      if (window && !doctor.on_leave) {
        const start = istTimeToDate(dateKey, window.start).getTime();
        const end = istTimeToDate(dateKey, window.end).getTime();
        for (let cursor = start; cursor + demoSlotMinutes * 60_000 <= end; cursor += demoSlotMinutes * 60_000) {
          if (cursor < now.getTime()) continue;
          const startIso = new Date(cursor).toISOString();
          slots.push({
            start: startIso,
            end: new Date(cursor + demoSlotMinutes * 60_000).toISOString(),
            available: !this.isSlotTaken(doctorId, startIso),
          });
        }
      }
      return { date: dateKey, label: offset === 0 ? ("today" as const) : offset === 1 ? ("tomorrow" as const) : ("later" as const), slots };
    });
    return { doctor_id: doctorId, days };
  }

  nextFreeSlotAfter(doctorId: string, afterIso: string): string | undefined {
    const after = new Date(afterIso).getTime();
    for (const day of this.slotsFor(doctorId).days) {
      const slot = day.slots.find((entry) => entry.available && new Date(entry.start).getTime() > after);
      if (slot) return slot.start;
    }
    return undefined;
  }

  createBooking(
    user: User,
    request: { doctor_id: string; profile_id: string; slot_start: string; purpose?: string },
    idempotencyKey: string,
  ): { status: number; body: unknown } {
    const cacheKey = `${user.id}|${idempotencyKey}`;
    const cached = this.idempotency.get(cacheKey);
    if (cached) return cached;

    this.requireDoctor(request.doctor_id);
    if (!user.profiles.some((profile) => profile.id === request.profile_id)) {
      throw new MockError(403, "profile_not_yours", "This profile does not belong to you");
    }

    const slots = this.slotsFor(request.doctor_id).days.flatMap((day) => day.slots);
    const slot = slots.find((entry) => entry.start === request.slot_start);
    if (!slot) throw new MockError(400, "invalid_slot", "This slot is not available any more");

    const isDemoRace =
      this.demo &&
      !this.raceDone && request.doctor_id === "doc_meera" && this.profileOwners.get(request.profile_id) === "pat_sunita";
    if (!slot.available || isDemoRace) {
      this.slotsTaken.add(`${request.doctor_id}|${request.slot_start}`);
      if (isDemoRace) this.raceDone = true;
      const next = this.nextFreeSlotAfter(request.doctor_id, request.slot_start);
      if (!next) throw new MockError(409, "no_slots_left", "No free slots are left for this doctor", false);
      const error = new MockError(409, "slot_taken", "That slot was just taken", true, { next_free_slot: next });
      const outcome = { status: 409, body: error.toBody() };
      this.idempotency.set(cacheKey, outcome);
      return outcome;
    }

    this.bookingCounter += 1;
    const booking: BookingRecord = {
      booking_id: `bk_${String(this.bookingCounter).padStart(4, "0")}`,
      doctor_id: request.doctor_id,
      profile_id: request.profile_id,
      slot_start: request.slot_start,
      status: "confirmed",
      ...(request.purpose ? { purpose: request.purpose } : {}),
    };
    this.slotsTaken.add(`${request.doctor_id}|${request.slot_start}`);
    this.bookings.set(booking.booking_id, booking);
    const outcome = { status: 201, body: booking };
    this.idempotency.set(cacheKey, outcome);
    return outcome;
  }

  issueTokenForBooking(user: User, bookingId: string, fastDemo: boolean): Token {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new MockError(404, "booking_not_found", "Booking not found");
    if (!user.profiles.some((profile) => profile.id === booking.profile_id)) {
      throw new MockError(403, "profile_not_yours", "This booking does not belong to you");
    }
    const existingId = this.bookingTokens.get(bookingId);
    const existing = existingId ? this.engine.token(existingId) : undefined;
    if (existing) return this.tokenView(existing);

    const demoPatient = this.demo && this.profileOwners.get(booking.profile_id) === "pat_sunita" && booking.doctor_id === "doc_meera";
    if (demoPatient && !this.rushDone) {
      this.engine.issueWalkIns("doc_meera", 2);
      this.engine.applyRush("doc_meera", 8, true);
    }
    const token = this.engine.issueToken(booking.doctor_id, booking.profile_id);
    this.bookingTokens.set(bookingId, token.id);

    if (demoPatient && !this.rushDone) {
      this.rushDone = true;
      const behind = this.engine.issueWalkIns("doc_meera", 1)[0];
      if (behind) {
        this.incomingPlan = {
          fromTokenId: behind.id,
          toTokenId: token.id,
          dueAtMs: Date.now() + (fastDemo ? swapAutoResolveFastMs : 20_000),
          created: false,
        };
      }
    }
    return this.tokenView(token);
  }

  tokenOwnedBy(user: User, tokenId: string): EngineToken {
    const token = this.engine.token(tokenId);
    if (!token) throw new MockError(404, "token_not_found", "Token not found");
    if (!token.profileId || !user.profiles.some((profile) => profile.id === token.profileId)) {
      throw new MockError(403, "token_not_yours", "This token does not belong to you");
    }
    return token;
  }

  tokensFor(user: User): Token[] {
    const profileIds = new Set(user.profiles.map((profile) => profile.id));
    return this.engine
      .allQueues()
      .flatMap((queue) => queue.tokens)
      .filter((token) => token.profileId && profileIds.has(token.profileId) && (token.status === "waiting" || token.status === "called"))
      .map((token) => this.tokenView(token));
  }

  private purposeOf(tokenId: string): string | undefined {
    for (const [bookingId, linked] of this.bookingTokens) {
      if (linked === tokenId) return this.bookings.get(bookingId)?.purpose;
    }
    return undefined;
  }

  tokenView(token: EngineToken): Token {
    const queue = this.engine.doctorQueue(token.doctorId);
    if (!queue) throw new MockError(404, "doctor_not_found", "Doctor not found");
    const doctor = queue.seed;
    const hospital = this.hospitalOf(doctor);
    const owner = this.ownerOfProfile(token.profileId) ?? this.patients.get("pat_sunita");
    const distance = owner ? distanceKm({ lat: owner.lat, lng: owner.lng }, hospital) : 2;
    const serving = this.engine.servingToken(queue);
    return {
      id: token.id,
      label: tokenLabel(queue, token.number),
      number: token.number,
      doctor_id: doctor.id,
      doctor_name: doctor.name,
      hospital_name: hospital.name,
      room: doctor.room,
      ...(this.purposeOf(token.id) ? { purpose: this.purposeOf(token.id) } : {}),
      profile_id: token.profileId,
      status: token.status,
      issued_at: new Date(token.issuedAtMs).toISOString(),
      now_serving: serving ? tokenLabel(queue, serving.number) : null,
      ahead: this.engine.aheadOf(token),
      travel_minutes: travelMinutesByAuto(distance),
      predicted_wait: this.engine.predictForToken(token),
      swap_requests_used: token.swapRequestsUsed,
      server_time: this.nowIso(),
    };
  }

  staffQueueView(doctorId: string): StaffQueue {
    const queue = this.engine.doctorQueue(doctorId);
    if (!queue) throw new MockError(404, "doctor_not_found", "Doctor not found");
    const serving = this.engine.servingToken(queue);
    const now = this.clock.now().getTime();
    const open = queue.tokens.filter((token) => token.status === "waiting" || token.status === "called").sort((a, b) => a.number - b.number);
    const closed = queue.tokens
      .filter((token) => token.status === "completed" || token.status === "cancelled")
      .sort((a, b) => (b.completedAtMs ?? 0) - (a.completedAtMs ?? 0))
      .slice(0, 5);
    const view = (token: EngineToken) => {
      const owner = this.ownerOfProfile(token.profileId);
      const profile = owner?.profiles.find((entry) => entry.id === token.profileId);
      const purpose = this.purposeOf(token.id);
      return {
        id: token.id,
        label: tokenLabel(queue, token.number),
        status: token.status,
        patient: profile?.name ?? "Walk-in patient",
        age: profile?.age ?? null,
        ...(purpose ? { purpose } : {}),
        issued_at: new Date(token.issuedAtMs).toISOString(),
        waited_minutes: Math.max(Math.round(((token.calledAtMs ?? now) - token.issuedAtMs) / 60_000), 0),
      };
    };
    return {
      doctor_id: doctorId,
      doctor_name: queue.seed.name,
      specialty: queue.seed.specialty,
      status: queue.status,
      delay_minutes: queue.delayMinutes,
      booking_mode: queue.bookingMode,
      now_serving: serving ? tokenLabel(queue, serving.number) : null,
      tokens: [...open, ...closed].map(view),
      server_time: this.nowIso(),
    };
  }

  queueView(doctorId: string): Queue {
    const queue = this.engine.doctorQueue(doctorId);
    if (!queue) throw new MockError(404, "doctor_not_found", "Doctor not found");
    const serving = this.engine.servingToken(queue);
    const waiting = this.engine.waitingTokens(queue);
    return {
      doctor_id: doctorId,
      now_serving: serving ? tokenLabel(queue, serving.number) : null,
      next: waiting.slice(0, 5).map((token) => ({ id: token.id, label: tokenLabel(queue, token.number) })),
      length: waiting.length + (serving ? 1 : 0),
      delay_minutes: queue.delayMinutes,
      status: queue.status,
      booking_mode: queue.bookingMode,
      server_time: this.nowIso(),
    };
  }

  private swapView(record: SwapRecord): SwapRequest {
    return {
      id: record.id,
      from_token: { id: record.fromTokenId, label: record.fromLabel },
      to_token: { id: record.toTokenId, label: record.toLabel },
      message: record.message,
      state: record.state,
      created_at: new Date(record.createdAtMs).toISOString(),
      expires_at: new Date(record.expiresAtMs).toISOString(),
      server_time: new Date().toISOString(),
    };
  }

  private labelOf(token: EngineToken): string {
    const queue = this.engine.doctorQueue(token.doctorId);
    if (!queue) throw new MockError(404, "doctor_not_found", "Doctor not found");
    return tokenLabel(queue, token.number);
  }

  private refreshSwaps(): void {
    const now = Date.now();
    if (this.incomingPlan && !this.incomingPlan.created && now >= this.incomingPlan.dueAtMs) {
      this.incomingPlan.created = true;
      this.swapCounter += 1;
      const id = `swap_${String(this.swapCounter).padStart(4, "0")}`;
      const planFrom = this.engine.token(this.incomingPlan.fromTokenId);
      const planTo = this.engine.token(this.incomingPlan.toTokenId);
      this.swaps.set(id, {
        id,
        fromTokenId: this.incomingPlan.fromTokenId,
        toTokenId: this.incomingPlan.toTokenId,
        fromLabel: planFrom ? this.labelOf(planFrom) : "",
        toLabel: planTo ? this.labelOf(planTo) : "",
        message: "Could we swap? I need to reach the pharmacy before it closes.",
        state: "pending",
        createdAtMs: now,
        expiresAtMs: now + swapExpiryMs,
        autoResolveAtMs: null,
      });
    }
    for (const record of this.swaps.values()) {
      if (record.state !== "pending") continue;
      if (now >= record.expiresAtMs) {
        record.state = "expired";
        continue;
      }
      if (record.autoResolveAtMs !== null && now >= record.autoResolveAtMs) this.resolveAutomatically(record);
    }
  }

  private resolveAutomatically(record: SwapRecord): void {
    const from = this.engine.token(record.fromTokenId);
    const to = this.engine.token(record.toTokenId);
    if (!from || !to || from.status !== "waiting" || to.status !== "waiting" || to.number > from.number) {
      record.state = "declined";
      return;
    }
    this.engine.swapPositions(from, to);
    record.state = "accepted";
  }

  private pendingFor(tokenId: string): SwapRecord | undefined {
    return [...this.swaps.values()].find(
      (record) => record.state === "pending" && (record.fromTokenId === tokenId || record.toTokenId === tokenId),
    );
  }

  swapCandidates(user: User, tokenId: string) {
    this.refreshSwaps();
    const mine = this.tokenOwnedBy(user, tokenId);
    const queue = this.engine.doctorQueue(mine.doctorId);
    if (!queue) throw new MockError(404, "doctor_not_found", "Doctor not found");
    const candidates = this.engine
      .waitingTokens(queue)
      .filter((other) => other.id !== mine.id && other.number < mine.number && !this.pendingFor(other.id))
      .map((other) => ({ id: other.id, label: tokenLabel(queue, other.number) }));
    return {
      candidates,
      requests_used: mine.swapRequestsUsed,
      max_requests: maxSwapRequests,
      has_pending: Boolean(this.pendingFor(mine.id)),
    };
  }

  createSwap(user: User, tokenId: string, toTokenId: string, message: string, fastDemo: boolean): SwapRequest {
    this.refreshSwaps();
    const mine = this.tokenOwnedBy(user, tokenId);
    const target = this.engine.token(toTokenId);
    if (!target || target.doctorId !== mine.doctorId) throw new MockError(400, "invalid_target", "Pick a token from the same queue");
    if (mine.status !== "waiting") throw new MockError(409, "token_called", "Your token has already been called");
    if (target.status !== "waiting" || target.number >= mine.number) {
      throw new MockError(400, "invalid_target", "You can only ask someone who is ahead of you and still waiting");
    }
    if (this.pendingFor(mine.id)) throw new MockError(409, "swap_pending", "You already have a request waiting for an answer");
    if (this.pendingFor(target.id)) throw new MockError(409, "target_busy", "That token already has a request waiting");
    if (mine.swapRequestsUsed >= maxSwapRequests) {
      throw new MockError(429, "swap_limit_reached", "You have used all 3 swap requests for this token");
    }

    mine.swapRequestsUsed += 1;
    this.swapCounter += 1;
    const now = Date.now();
    const id = `swap_${String(this.swapCounter).padStart(4, "0")}`;
    const record: SwapRecord = {
      id,
      fromTokenId: mine.id,
      toTokenId: target.id,
      fromLabel: this.labelOf(mine),
      toLabel: this.labelOf(target),
      message,
      state: "pending",
      createdAtMs: now,
      expiresAtMs: now + swapExpiryMs,
      autoResolveAtMs: target.profileId === null ? now + (fastDemo ? swapAutoResolveFastMs : swapAutoResolveMs) : null,
    };
    this.swaps.set(id, record);
    return this.swapView(record);
  }

  incomingSwaps(user: User): SwapRequest[] {
    this.refreshSwaps();
    const profileIds = new Set(user.profiles.map((profile) => profile.id));
    return [...this.swaps.values()]
      .filter((record) => record.state === "pending")
      .filter((record) => {
        const target = this.engine.token(record.toTokenId);
        return target?.profileId ? profileIds.has(target.profileId) : false;
      })
      .map((record) => this.swapView(record));
  }

  outgoingSwap(user: User, tokenId: string): SwapRequest | undefined {
    this.refreshSwaps();
    this.tokenOwnedBy(user, tokenId);
    const latest = [...this.swaps.values()].filter((record) => record.fromTokenId === tokenId).sort((a, b) => b.createdAtMs - a.createdAtMs)[0];
    return latest ? this.swapView(latest) : undefined;
  }

  private requireSwap(id: string): SwapRecord {
    this.refreshSwaps();
    const record = this.swaps.get(id);
    if (!record) throw new MockError(404, "swap_not_found", "Swap request not found");
    return record;
  }

  respondToSwap(user: User, id: string, accept: boolean): SwapRequest {
    const record = this.requireSwap(id);
    this.tokenOwnedBy(user, record.toTokenId);
    if (record.state !== "pending") throw new MockError(409, "swap_closed", `This request is already ${record.state}`);
    if (accept) {
      const from = this.engine.token(record.fromTokenId);
      const to = this.engine.token(record.toTokenId);
      if (!from || !to || from.status !== "waiting" || to.status !== "waiting") {
        record.state = "declined";
        throw new MockError(409, "swap_closed", "One of the tokens is no longer waiting");
      }
      this.engine.swapPositions(from, to);
      record.state = "accepted";
    } else {
      record.state = "declined";
    }
    return this.swapView(record);
  }

  cancelSwap(user: User, id: string): SwapRequest {
    const record = this.requireSwap(id);
    this.tokenOwnedBy(user, record.fromTokenId);
    if (record.state !== "pending") throw new MockError(409, "swap_closed", `This request is already ${record.state}`);
    record.state = "cancelled";
    return this.swapView(record);
  }

  nearestEmergency(origin: { lat: number; lng: number }) {
    const nearest = seedHospitals
      .filter((entry) => entry.has_emergency)
      .map((entry) => ({ entry, distance: distanceKm(origin, entry) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!nearest) throw new MockError(503, "no_emergency_department", "No emergency department is available", true);
    return {
      hospital: hospitalView(nearest.entry),
      distance_km: roundOneDecimal(nearest.distance),
      eta_minutes: Math.max(Math.round(nearest.distance * 3 + 4), 5),
    };
  }

  createEmergency(user: User, request: { lat: number; lng: number; profile_id: string; summary: string }) {
    const nearest = this.nearestEmergency({ lat: request.lat, lng: request.lng });
    const hospital = { entry: nearest.hospital, distance: nearest.distance_km };
    const profile = user.profiles.find((entry) => entry.id === request.profile_id) ?? user.profiles[0];
    this.alertCounter += 1;
    const eta = nearest.eta_minutes;
    const record: PreAlertRecord = {
      id: `alert_${String(this.alertCounter).padStart(3, "0")}`,
      hospitalId: hospital.entry.id,
      patientLabel: profile ? `${profile.name}` : "Patient",
      age: profile?.age ?? 0,
      summary: request.summary,
      etaMinutes: eta,
      receivedAt: this.nowIso(),
    };
    this.alerts.unshift(record);
    this.engine.emit({ type: "emergency_prealert", token_id: record.id, label: record.patientLabel });
    return { alert_id: record.id, hospital: hospitalView(hospital.entry), eta_minutes: eta, received_at: record.receivedAt };
  }

  subscribe(listener: (event: QueueEventPayload) => void): () => void {
    return this.engine.subscribe(listener);
  }

  tick(realMilliseconds: number): void {
    const simMinutes = (realMilliseconds / 60_000) * this.clock.speed();
    this.engine.advance(simMinutes);
  }

  formatSlotLabel(startIso: string): string {
    const parts = istParts(new Date(startIso));
    return formatClockLabel(parts.hour, parts.minute);
  }
}
