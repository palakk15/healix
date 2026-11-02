import { formatClockLabel, istDateKey, istParts } from "@core/domain/time";
import { modeStory } from "./modeStory";
import { tokenLabel } from "./queue";
import { seedHistory, type MockWorld } from "./world";

const pessimisticBufferMinutes = 10;

function hospitalDoctorIds(world: MockWorld, hospitalId: string): string[] {
  return [...world.doctors.values()].filter((doctor) => doctor.hospital_id === hospitalId).map((doctor) => doctor.id);
}

export function dashboardDoctors(world: MockWorld, hospitalId: string) {
  const rows = hospitalDoctorIds(world, hospitalId).flatMap((doctorId) => {
    const queue = world.engine.doctorQueue(doctorId);
    if (!queue) return [];
    const serving = world.engine.servingToken(queue);
    const waiting = world.engine.waitingTokens(queue);
    const active = queue.status === "running" || queue.status === "delayed";
    return [
      {
        doctor_id: doctorId,
        name: queue.seed.name,
        specialty: queue.seed.specialty,
        now_serving: serving ? tokenLabel(queue, serving.number) : null,
        waiting: waiting.length,
        predicted_wait_minutes: active ? world.engine.predictForNewArrival(doctorId).wait_minutes : 0,
        status: queue.status,
        next_token_id: waiting[0]?.id ?? null,
        serving_token_id: serving?.id ?? null,
        booking_mode: queue.bookingMode,
      },
    ];
  });
  return { doctors: rows, server_time: world.nowIso() };
}

export function dashboardOverview(world: MockWorld, hospitalId: string) {
  const { doctors } = dashboardDoctors(world, hospitalId);
  const active = doctors.filter((row) => row.status === "running" || row.status === "delayed");
  const totalWaiting = doctors.reduce((sum, row) => sum + row.waiting, 0);
  const average = active.length === 0 ? 0 : active.reduce((sum, row) => sum + row.predicted_wait_minutes, 0) / active.length;
  const busiest = [...doctors].sort((a, b) => b.waiting - a.waiting)[0];
  return {
    total_waiting: totalWaiting,
    average_wait_minutes: Math.round(average),
    busiest_doctor: busiest && busiest.waiting > 0 ? { id: busiest.doctor_id, name: busiest.name, waiting: busiest.waiting } : null,
    server_time: world.nowIso(),
  };
}

export function dashboardBookingModes(world: MockWorld, hospitalId: string) {
  const now = world.clock.now();
  const modes = dashboardDoctors(world, hospitalId).doctors.map((row) => {
    const queue = world.engine.doctorQueue(row.doctor_id);
    const bufferMinutes = row.booking_mode === "pessimistic" ? pessimisticBufferMinutes : 0;
    return {
      doctor_id: row.doctor_id,
      name: row.name,
      mode: row.booking_mode,
      slot_buffer_minutes: bufferMinutes,
      predicted_wait_minutes: row.predicted_wait_minutes,
      reason: queue
        ? modeStory({
            doctor: queue.seed,
            mode: row.booking_mode,
            status: row.status,
            waiting: row.waiting,
            predictedWait: Math.round(row.predicted_wait_minutes),
            delayMinutes: queue.delayMinutes,
            quickFollowUps: queue.quickFollowUps,
            bufferMinutes: pessimisticBufferMinutes,
            now,
          })
        : "",
    };
  });
  return { modes, server_time: world.nowIso() };
}

export function dashboardAnalytics() {
  const byHour = new Map<number, { patients: number; actual: number; predicted: number; count: number }>();
  for (const day of seedHistory.days) {
    for (const hour of day.hours) {
      const entry = byHour.get(hour.hour) ?? { patients: 0, actual: 0, predicted: 0, count: 0 };
      entry.patients += hour.patients;
      entry.actual += hour.actual_wait;
      entry.predicted += hour.model_prediction;
      entry.count += 1;
      byHour.set(hour.hour, entry);
    }
  }
  const hours = [...byHour.keys()].sort((a, b) => a - b);
  return {
    patients_per_hour: hours.map((hour) => {
      const entry = byHour.get(hour);
      return { hour, label: formatClockLabel(hour), patients: Math.round((entry?.patients ?? 0) / (entry?.count ?? 1)) };
    }),
    predicted_vs_actual: hours.map((hour) => {
      const entry = byHour.get(hour);
      const count = entry?.count ?? 1;
      return {
        hour,
        label: formatClockLabel(hour),
        predicted: Math.round(((entry?.predicted ?? 0) / count) * 10) / 10,
        actual: Math.round(((entry?.actual ?? 0) / count) * 10) / 10,
      };
    }),
    synthetic: true,
  };
}

export function dashboardAccuracy() {
  return {
    model_mae_minutes: seedHistory.model_mae,
    simple_mae_minutes: seedHistory.simple_mae,
    daily: seedHistory.days.map((day) => ({ date: day.date, model_mae: day.model_mae, simple_mae: day.simple_mae })),
    synthetic: true,
  };
}

const minimumRealSamples = 5;

interface WaitSample {
  hour: number;
  date: string;
  predicted: number;
  simple: number;
  actual: number;
}

function realWaitSamples(world: MockWorld, hospitalId: string): { issued: Array<{ hour: number; date: string }>; samples: WaitSample[] } {
  const issued: Array<{ hour: number; date: string }> = [];
  const samples: WaitSample[] = [];
  for (const doctorId of hospitalDoctorIds(world, hospitalId)) {
    const queue = world.engine.doctorQueue(doctorId);
    if (!queue) continue;
    for (const token of queue.tokens) {
      const when = new Date(token.issuedAtMs);
      issued.push({ hour: istParts(when).hour, date: istDateKey(when) });
      if (token.calledAtMs !== null && token.predictedMinutes !== undefined && token.simpleMinutes !== undefined) {
        samples.push({
          hour: istParts(when).hour,
          date: istDateKey(when),
          predicted: token.predictedMinutes,
          simple: token.simpleMinutes,
          actual: Math.max((token.calledAtMs - token.issuedAtMs) / 60_000, 0),
        });
      }
    }
  }
  return { issued, samples };
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

export function dashboardAnalyticsFor(world: MockWorld, hospitalId: string) {
  if (world.demo) return dashboardAnalytics();
  const { issued, samples } = realWaitSamples(world, hospitalId);
  if (samples.length < minimumRealSamples) return dashboardAnalytics();
  const days = new Set(issued.map((entry) => entry.date)).size || 1;
  const hours = [...new Set(issued.map((entry) => entry.hour))].sort((a, b) => a - b);
  return {
    patients_per_hour: hours.map((hour) => ({
      hour,
      label: formatClockLabel(hour),
      patients: Math.round((issued.filter((entry) => entry.hour === hour).length / days) * 10) / 10,
    })),
    predicted_vs_actual: [...new Set(samples.map((sample) => sample.hour))]
      .sort((a, b) => a - b)
      .map((hour) => {
        const group = samples.filter((sample) => sample.hour === hour);
        return { hour, label: formatClockLabel(hour), predicted: round1(mean(group.map((entry) => entry.predicted))), actual: round1(mean(group.map((entry) => entry.actual))) };
      }),
    synthetic: false,
  };
}

export function dashboardAccuracyFor(world: MockWorld, hospitalId: string) {
  if (world.demo) return dashboardAccuracy();
  const { samples } = realWaitSamples(world, hospitalId);
  if (samples.length < minimumRealSamples) return dashboardAccuracy();
  const modelError = (group: WaitSample[]) => mean(group.map((entry) => Math.abs(entry.predicted - entry.actual)));
  const simpleError = (group: WaitSample[]) => mean(group.map((entry) => Math.abs(entry.simple - entry.actual)));
  return {
    model_mae_minutes: round1(modelError(samples)),
    simple_mae_minutes: round1(simpleError(samples)),
    daily: [...new Set(samples.map((sample) => sample.date))].sort().map((date) => {
      const group = samples.filter((sample) => sample.date === date);
      return { date, model_mae: round1(modelError(group)), simple_mae: round1(simpleError(group)) };
    }),
    synthetic: false,
  };
}
