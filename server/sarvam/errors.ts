export class SarvamError extends Error {
  constructor(
    readonly status: 400 | 413 | 429 | 502 | 503 | 504,
    readonly code: string,
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
    this.name = "SarvamError";
  }

  toBody() {
    return { error: { code: this.code, message: this.message, retry: this.retry } };
  }
}

export const unavailable = () =>
  new SarvamError(503, "sarvam_unavailable", "Voice features are not available right now", false);

export const notConfigured = (what: string) =>
  new SarvamError(503, "sarvam_not_configured", `Sarvam ${what} is not configured on the server`, false);
