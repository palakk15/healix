import { z } from "zod";

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retry: z.boolean(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export class ApiError extends Error {
  readonly code: string;
  readonly retry: boolean;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, retry: boolean, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retry = retry;
    this.status = status;
    this.details = details;
  }
}

export function networkError(): ApiError {
  return new ApiError("network_error", "Network request failed", true, 0);
}

export function invalidResponseError(): ApiError {
  return new ApiError("invalid_response", "Response did not match the expected shape", false, 502);
}
