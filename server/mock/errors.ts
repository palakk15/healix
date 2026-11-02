export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retry = false,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "MockError";
  }

  toBody() {
    return { error: { code: this.code, message: this.message, retry: this.retry }, ...this.extra };
  }
}
