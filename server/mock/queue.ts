import { istMinutesOfDay, istParts } from "@core/domain/time";
import type { MockClock } from "./clock";
import type { Rng } from "./rng";
import type { SeedDoctor } from "./seed-types";
import { predictWait, type WaitPrediction } from "./waitModel";

export type TokenStatus = "waiting" | "called" | "completed" | "cancelled";
export type DoctorStatus = "running" | "delayed" | "break" | "closed" | "on_leave";
export type BookingMode = "optimistic" | "pessimistic";

export interface EngineToken {
  id: string;
  number: number;
  doctorId: string;
  profileId: string | null;
  status: TokenStatus;
  issuedAtMs: number;
  calledAtMs: number | null;
  completedAtMs: number | null;
  swapRequestsUsed: number;
  predictedMinutes?: number;
  simpleMinutes?: number;
}

export interface DoctorQueue {
  doctorId: string;
  seed: SeedDoctor;
  tokens: EngineToken[];
  nextNumber: number;
  consultRemaining: number;
  delayMinutes: number;
  quickFollowUps: boolean;
  status: DoctorStatus;
  bookingMode: BookingMode;
  arrivalBoost: number;
  highStreak: number;
  calmStreak: number;
  observedConsult?: number;
  onBreak?: boolean;
}

export interface EngineSnapshot {
  tokenCounter: number;
  queues: Array<Omit<DoctorQueue, "seed">>;
}

export interface EngineOptions {
  empty?: boolean;
  learnConsultTimes?: boolean;
}

export type QueueEventType =
  | "token_issued"
  | "token_called"
  | "token_completed"
  | "swap_accepted"
  | "doctor_delay"
  | "emergency_prealert";

export interface QueueEventPayload {
  type: QueueEventType;
  doctor_id?: string;
  token_id?: string;
  label?: string;
  delay_minutes?: number;
  token_ids?: string[];
  at: string;
}

type Listener = (event: QueueEventPayload) => void;

export const pessimisticAboveMinutes = 35;
export const optimisticBelowMinutes = 25;
export const standardSlotMinutes = 20;

function hourFactor(hour: number): number {
  const factors: Record<number, number> = { 9: 1.2, 10: 1.5, 11: 1.4, 12: 0.9, 13: 0.5, 14: 0.8, 15: 1.0, 16: 0.9 };
  return factors[hour] ?? 0.4;
}

export function tokenLabel(queue: DoctorQueue, number: number): string {
  return `${queue.seed.token_prefix}-${String(number).padStart(2, "0")}`;
}

export function isWorkingAt(doctor: SeedDoctor, date: Date): boolean {
  if (doctor.on_leave) return false;
  const parts = istParts(date);
  const minutes = istMinutesOfDay(date);
  return doctor.schedule.some((window) => {
    if (window.day !== parts.weekday) return false;
    const [startHour, startMinute] = window.start.split(":").map(Number);
    const [endHour, endMinute] = window.end.split(":").map(Number);
    return minutes >= (startHour ?? 0) * 60 + (startMinute ?? 0) && minutes < (endHour ?? 0) * 60 + (endMinute ?? 0);
  });
}

export class QueueEngine {
  private queues = new Map<string, DoctorQueue>();
  private tokensById = new Map<string, EngineToken>();
  private listeners = new Set<Listener>();
  private tokenCounter = 0;

  constructor(
    private readonly doctors: SeedDoctor[],
    private readonly clock: MockClock,
    private readonly rng: Rng,
    private readonly options: EngineOptions = {},
  ) {
    this.reset({ empty: options.empty ?? false });
  }

  snapshot(): EngineSnapshot {
    return {
      tokenCounter: this.tokenCounter,
      queues: [...this.queues.values()].map((queue) => {
        const copy: Partial<DoctorQueue> = structuredClone({ ...queue, seed: undefined });
        delete copy.seed;
        return copy as Omit<DoctorQueue, "seed">;
      }),
    };
  }

  restore(snapshot: EngineSnapshot): void {
    this.tokensById.clear();
    this.tokenCounter = snapshot.tokenCounter;
    for (const saved of snapshot.queues) {
      const queue = this.queues.get(saved.doctorId);
      if (!queue) continue;
      Object.assign(queue, structuredClone(saved), { seed: queue.seed });
      for (const token of queue.tokens) this.tokensById.set(token.id, token);
    }
  }

  refreshStatuses(): void {
    const now = this.clock.now();
    for (const queue of this.queues.values()) {
      if (queue.seed.on_leave) queue.status = "on_leave";
      else if (queue.onBreak) queue.status = "break";
      else if (!isWorkingAt(queue.seed, now) && this.activeCount(queue) === 0) queue.status = "closed";
      else {
        const serving = this.servingToken(queue);
        const expected = this.expectedConsult(queue);
        const over = serving?.calledAtMs ? (now.getTime() - serving.calledAtMs) / 60_000 - expected * 1.5 : 0;
        const delay = Math.min(Math.max(Math.round(over), 0), 30);
        if (delay !== queue.delayMinutes) this.setDelay(queue.doctorId, delay);
        queue.status = queue.delayMinutes >= 8 ? "delayed" : "running";
      }
      this.updateBookingMode(queue);
    }
  }

  expectedConsult(queue: DoctorQueue): number {
    return queue.observedConsult ?? queue.seed.observed_consult_minutes;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: Omit<QueueEventPayload, "at">): void {
    const payload: QueueEventPayload = { ...event, at: this.clock.now().toISOString() };
    for (const listener of this.listeners) listener(payload);
  }

  reset(options: { empty?: boolean } = {}): void {
    this.queues.clear();
    this.tokensById.clear();
    this.tokenCounter = 0;
    const now = this.clock.now();

    for (const doctor of this.doctors) {
      const working = isWorkingAt(doctor, now);
      const queue: DoctorQueue = {
        doctorId: doctor.id,
        seed: doctor,
        tokens: [],
        nextNumber: this.rng.int(5, 40),
        consultRemaining: 0,
        delayMinutes: 0,
        quickFollowUps: false,
        status: doctor.on_leave ? "on_leave" : working ? "running" : "closed",
        bookingMode: doctor.booking_mode,
        arrivalBoost: 1,
        highStreak: 0,
        calmStreak: 0,
      };
      this.queues.set(doctor.id, queue);
      if (!options.empty && working) this.seedBusyQueue(queue);
    }
    if (!options.empty) this.seedScriptedDoctors();
  }

  private seedBusyQueue(queue: DoctorQueue): void {
    const waiting = Math.max(1, Math.round(this.rng.int(1, 6) * queue.seed.popularity));
    queue.delayMinutes = this.rng.chance(0.3) ? this.rng.int(2, 8) : 0;
    const serving = this.createToken(queue, null, false);
    this.callToken(serving, false);
    for (let index = 0; index < waiting; index += 1) this.createToken(queue, null, false);
  }

  private seedScriptedDoctors(): void {
    const meera = this.queues.get("doc_meera");
    if (meera) this.forceQueue(meera, 18, 2, 2, false);
    const arjun = this.queues.get("doc_arjun");
    if (arjun) this.forceQueue(arjun, 9, 3, 0, false);
    const fatima = this.queues.get("doc_fatima");
    if (fatima) this.forceQueue(fatima, 41, 11, 4, false);
  }

  private forceQueue(queue: DoctorQueue, serving: number, waiting: number, delay: number, quick: boolean): void {
    for (const token of queue.tokens) this.tokensById.delete(token.id);
    queue.tokens = [];
    queue.nextNumber = serving;
    queue.delayMinutes = delay;
    queue.quickFollowUps = quick;
    queue.status = "running";
    const current = this.createToken(queue, null, false);
    this.callToken(current, false);
    queue.consultRemaining = 4;
    for (let index = 0; index < waiting; index += 1) this.createToken(queue, null, false);
  }

  doctorQueue(doctorId: string): DoctorQueue | undefined {
    return this.queues.get(doctorId);
  }

  allQueues(): DoctorQueue[] {
    return [...this.queues.values()];
  }

  token(tokenId: string): EngineToken | undefined {
    return this.tokensById.get(tokenId);
  }

  private createToken(queue: DoctorQueue, profileId: string | null, announce: boolean): EngineToken {
    const waitingNow = this.activeCount(queue);
    const predictedMinutes = this.predictFor(queue, waitingNow).wait_minutes;
    const simpleMinutes = Math.round(waitingNow * queue.seed.observed_consult_minutes);
    this.tokenCounter += 1;
    const token: EngineToken = {
      id: `tok_${String(this.tokenCounter).padStart(5, "0")}`,
      number: queue.nextNumber,
      doctorId: queue.doctorId,
      profileId,
      status: "waiting",
      issuedAtMs: this.clock.now().getTime(),
      calledAtMs: null,
      completedAtMs: null,
      swapRequestsUsed: 0,
      predictedMinutes,
      simpleMinutes,
    };
    queue.nextNumber += 1;
    queue.tokens.push(token);
    this.tokensById.set(token.id, token);
    if (announce) this.emit({ type: "token_issued", doctor_id: queue.doctorId, token_id: token.id, label: tokenLabel(queue, token.number) });
    return token;
  }

  issueToken(doctorId: string, profileId: string | null): EngineToken {
    const queue = this.requireQueue(doctorId);
    if (queue.status === "closed" || queue.status === "on_leave") queue.status = "running";
    return this.createToken(queue, profileId, true);
  }

  issueWalkIns(doctorId: string, count: number): EngineToken[] {
    const queue = this.requireQueue(doctorId);
    return Array.from({ length: count }, () => this.createToken(queue, null, true));
  }

  applyRush(doctorId: string, delayMinutes: number, quickFollowUps: boolean): void {
    const queue = this.requireQueue(doctorId);
    queue.delayMinutes = delayMinutes;
    queue.quickFollowUps = quickFollowUps;
    this.emit({ type: "doctor_delay", doctor_id: doctorId, delay_minutes: delayMinutes });
  }

  setDelay(doctorId: string, delayMinutes: number): void {
    const queue = this.requireQueue(doctorId);
    if (queue.delayMinutes === delayMinutes) return;
    queue.delayMinutes = delayMinutes;
    if (queue.status === "running" || queue.status === "delayed") queue.status = delayMinutes >= 8 ? "delayed" : "running";
    this.emit({ type: "doctor_delay", doctor_id: doctorId, delay_minutes: delayMinutes });
  }

  setArrivalBoost(doctorId: string, boost: number): void {
    this.requireQueue(doctorId).arrivalBoost = boost;
  }

  private requireQueue(doctorId: string): DoctorQueue {
    const queue = this.queues.get(doctorId);
    if (!queue) throw new Error(`Unknown doctor ${doctorId}`);
    return queue;
  }

  waitingTokens(queue: DoctorQueue): EngineToken[] {
    return queue.tokens.filter((token) => token.status === "waiting").sort((a, b) => a.number - b.number);
  }

  servingToken(queue: DoctorQueue): EngineToken | undefined {
    return queue.tokens.find((token) => token.status === "called");
  }

  activeCount(queue: DoctorQueue): number {
    return queue.tokens.filter((token) => token.status === "waiting" || token.status === "called").length;
  }

  aheadOf(token: EngineToken): number {
    const queue = this.requireQueue(token.doctorId);
    return queue.tokens.filter(
      (other) => (other.status === "waiting" || other.status === "called") && other.number < token.number,
    ).length;
  }

  private callToken(token: EngineToken, announce: boolean): void {
    const queue = this.requireQueue(token.doctorId);
    token.status = "called";
    token.calledAtMs = this.clock.now().getTime();
    queue.consultRemaining = Math.max(
      3,
      this.rng.normal(queue.seed.observed_consult_minutes, queue.seed.observed_consult_minutes * 0.25),
    );
    if (announce) this.emit({ type: "token_called", doctor_id: queue.doctorId, token_id: token.id, label: tokenLabel(queue, token.number) });
  }

  call(tokenId: string): "ok" | "not_found" | "already_serving" | "not_waiting" {
    const token = this.tokensById.get(tokenId);
    if (!token) return "not_found";
    if (token.status !== "waiting") return "not_waiting";
    const queue = this.requireQueue(token.doctorId);
    if (this.servingToken(queue)) return "already_serving";
    this.callToken(token, true);
    return "ok";
  }

  complete(tokenId: string): "ok" | "not_found" | "not_called" {
    const token = this.tokensById.get(tokenId);
    if (!token) return "not_found";
    if (token.status !== "called") return "not_called";
    const queue = this.requireQueue(token.doctorId);
    token.status = "completed";
    token.completedAtMs = this.clock.now().getTime();
    queue.consultRemaining = 0;
    if (this.options.learnConsultTimes && token.calledAtMs !== null) {
      const minutes = Math.min(Math.max((token.completedAtMs - token.calledAtMs) / 60_000, 2), 60);
      queue.observedConsult = Math.round((this.expectedConsult(queue) * 0.8 + minutes * 0.2) * 10) / 10;
    }
    this.emit({ type: "token_completed", doctor_id: queue.doctorId, token_id: token.id, label: tokenLabel(queue, token.number) });
    return "ok";
  }

  cancel(tokenId: string): void {
    const token = this.tokensById.get(tokenId);
    if (token && token.status === "waiting") token.status = "cancelled";
  }

  skip(tokenId: string): "ok" | "not_found" | "not_active" {
    const token = this.tokensById.get(tokenId);
    if (!token) return "not_found";
    if (token.status !== "waiting" && token.status !== "called") return "not_active";
    const queue = this.requireQueue(token.doctorId);
    if (token.status === "called") queue.consultRemaining = 0;
    token.status = "cancelled";
    token.completedAtMs = this.clock.now().getTime();
    this.emit({ type: "token_completed", doctor_id: queue.doctorId, token_id: token.id, label: tokenLabel(queue, token.number) });
    return "ok";
  }

  setBreak(doctorId: string, onBreak: boolean): void {
    const queue = this.requireQueue(doctorId);
    queue.onBreak = onBreak;
    if (queue.status !== "on_leave") queue.status = onBreak ? "break" : queue.delayMinutes >= 8 ? "delayed" : "running";
    this.emit({ type: "doctor_delay", doctor_id: doctorId, delay_minutes: queue.delayMinutes });
  }

  swapPositions(first: EngineToken, second: EngineToken): void {
    const firstNumber = first.number;
    first.number = second.number;
    second.number = firstNumber;
    this.emit({ type: "swap_accepted", doctor_id: first.doctorId, token_ids: [first.id, second.id] });
  }

  predictFor(queue: DoctorQueue, aheadCount: number): WaitPrediction {
    const now = this.clock.now();
    const parts = istParts(now);
    return predictWait({
      aheadCount,
      observedConsultMinutes: this.expectedConsult(queue),
      delayMinutes: queue.delayMinutes,
      quickFollowUps: queue.quickFollowUps,
      hour: parts.hour,
      weekday: parts.weekday,
      nowIso: now.toISOString(),
    });
  }

  predictForNewArrival(doctorId: string): WaitPrediction {
    const queue = this.requireQueue(doctorId);
    return this.predictFor(queue, this.activeCount(queue));
  }

  predictForToken(token: EngineToken): WaitPrediction {
    return this.predictFor(this.requireQueue(token.doctorId), this.aheadOf(token));
  }

  advance(simMinutes: number): void {
    const step = 0.5;
    let remaining = simMinutes;
    while (remaining > 0) {
      const chunk = Math.min(step, remaining);
      remaining -= chunk;
      for (const queue of this.queues.values()) this.advanceQueue(queue, chunk);
    }
  }

  private advanceQueue(queue: DoctorQueue, minutes: number): void {
    if (queue.status === "on_leave" || queue.status === "closed") return;
    const hour = istParts(this.clock.now()).hour;
    const arrivalRate = (0.55 * queue.seed.popularity * hourFactor(hour) * queue.arrivalBoost) / queue.seed.observed_consult_minutes;
    const arrivals = this.rng.poisson(arrivalRate * minutes);
    for (let index = 0; index < arrivals; index += 1) this.createToken(queue, null, true);

    const serving = this.servingToken(queue);
    if (serving) {
      queue.consultRemaining -= minutes;
      if (queue.consultRemaining <= 0) this.complete(serving.id);
    } else if (!queue.onBreak) {
      const next = this.waitingTokens(queue)[0];
      if (next) this.callToken(next, true);
    }

    queue.status = queue.onBreak ? "break" : queue.delayMinutes >= 8 ? "delayed" : "running";
    this.updateBookingMode(queue);
  }

  private updateBookingMode(queue: DoctorQueue): void {
    const wait = this.predictForNewArrival(queue.doctorId).wait_minutes;
    if (wait > pessimisticAboveMinutes) {
      queue.highStreak += 1;
      queue.calmStreak = 0;
    } else if (wait < optimisticBelowMinutes) {
      queue.calmStreak += 1;
      queue.highStreak = 0;
    }
    if (queue.bookingMode === "optimistic" && queue.highStreak >= 6) queue.bookingMode = "pessimistic";
    if (queue.bookingMode === "pessimistic" && queue.calmStreak >= 12) queue.bookingMode = "optimistic";
  }
}
