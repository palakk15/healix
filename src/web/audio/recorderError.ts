export type RecorderFailure = "denied" | "no_device" | "failed";

export class RecorderError extends Error {
  constructor(readonly reason: RecorderFailure) {
    super(`Recorder failed: ${reason}`);
    this.name = "RecorderError";
  }
}
