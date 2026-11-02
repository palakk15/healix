import type { SimulatorStatus } from "@core/api/schemas/backend";
import { istMinutesOfDay } from "@core/domain/time";
import type { MockWorld } from "./world";

export const replayStartMinute = 9 * 60;
export const replayEndMinute = 17 * 60;
const rushStartMinute = 10 * 60;
const rushEndMinute = 11 * 60 + 30;
const rushDoctorId = "doc_fatima";
const rushDoctorBoost = 1.5;
const generalBoost = 1.2;

export interface SimulatorOptions {
  liveIntervalMs: number;
  replayTickMs: number;
}

export class Simulator {
  private liveTimer: ReturnType<typeof setInterval> | null = null;
  private replayTimer: ReturnType<typeof setInterval> | null = null;
  private mode: SimulatorStatus["mode"] = "live";
  private running = false;
  private progress = 0;

  constructor(
    private readonly world: MockWorld,
    private readonly options: SimulatorOptions = { liveIntervalMs: 3000, replayTickMs: 250 },
  ) {}

  startLive(): void {
    if (this.liveTimer) return;
    this.liveTimer = setInterval(() => {
      if (this.mode === "live") this.world.tick(this.options.liveIntervalMs);
    }, this.options.liveIntervalMs);
    this.liveTimer.unref();
  }

  status(): SimulatorStatus {
    return {
      running: this.running,
      mode: this.mode,
      simulated_time: this.world.nowIso(),
      progress: this.progress,
      speed: this.world.clock.speed(),
    };
  }

  startReplay(durationSeconds = 120): SimulatorStatus {
    this.stopReplayTimer();
    this.mode = "replay";
    this.running = true;
    this.progress = 0;
    this.world.engine.reset({ empty: true });
    this.world.clock.setSpeed(0);
    this.world.clock.jumpTo(replayStartMinute);

    const totalTicks = Math.max(Math.round((durationSeconds * 1000) / this.options.replayTickMs), 1);
    const minutesPerTick = (replayEndMinute - replayStartMinute) / totalTicks;
    let tick = 0;

    this.replayTimer = setInterval(() => {
      tick += 1;
      this.stepReplay(replayStartMinute + tick * minutesPerTick, minutesPerTick);
      this.progress = Math.min(tick / totalTicks, 1);
      if (tick >= totalTicks) this.finishReplay();
    }, this.options.replayTickMs);
    this.replayTimer.unref();
    return this.status();
  }

  stepReplay(simMinute: number, minutes: number): void {
    this.world.clock.jumpTo(simMinute);
    const inRush = simMinute >= rushStartMinute && simMinute < rushEndMinute;
    for (const queue of this.world.engine.allQueues()) {
      const boost = queue.doctorId === rushDoctorId ? (inRush ? rushDoctorBoost : 1) : inRush ? generalBoost : 1;
      this.world.engine.setArrivalBoost(queue.doctorId, boost);
    }
    if (simMinute >= rushStartMinute + 10 && simMinute < rushEndMinute) this.world.engine.setDelay(rushDoctorId, 10);
    if (simMinute >= rushEndMinute + 15) this.world.engine.setDelay(rushDoctorId, 0);
    this.world.engine.advance(minutes);
  }

  private finishReplay(): void {
    this.stopReplayTimer();
    this.running = false;
    this.progress = 1;
    this.world.clock.setSpeed(1);
    this.mode = "live";
  }

  stop(): SimulatorStatus {
    this.stopReplayTimer();
    this.running = false;
    this.mode = "live";
    this.world.clock.setSpeed(1);
    return this.status();
  }

  reset(): SimulatorStatus {
    this.stopReplayTimer();
    this.running = false;
    this.progress = 0;
    this.mode = "live";
    this.world.resetDemoState();
    return this.status();
  }

  setSpeed(speed: number): SimulatorStatus {
    this.world.clock.setSpeed(Math.min(Math.max(speed, 1), 60));
    return this.status();
  }

  private stopReplayTimer(): void {
    if (this.replayTimer) clearInterval(this.replayTimer);
    this.replayTimer = null;
  }

  dispose(): void {
    this.stopReplayTimer();
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = null;
  }

  simulatedMinuteOfDay(): number {
    return istMinutesOfDay(this.world.clock.now());
  }
}
