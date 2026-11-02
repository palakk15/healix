import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { MockWorld, WorldSnapshot } from "../mock/world";

export function ensureSecret(directory: string): string {
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, "jwt-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export function loadSnapshot(world: MockWorld, file: string): boolean {
  if (!existsSync(file)) return false;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as WorldSnapshot;
    if (parsed.version !== 1) return false;
    world.restore(parsed);
    return true;
  } catch {
    return false;
  }
}

export function writeSnapshot(world: MockWorld, file: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(world.snapshot()));
  renameSync(temporary, file);
}

export interface Saver {
  schedule: () => void;
  flush: () => void;
}

export function createSaver(world: MockWorld, file: string, delayMs = 700): Saver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      writeSnapshot(world, file);
    } catch (error) {
      console.error("Could not save Healix data", error instanceof Error ? error.message : error);
    }
  };
  return {
    schedule: () => {
      if (timer) return;
      timer = setTimeout(flush, delayMs);
      timer.unref();
    },
    flush,
  };
}
