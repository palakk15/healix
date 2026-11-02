import type { z } from "zod";
import { apiConfig } from "./config";
import { ApiError, apiErrorBodySchema, invalidResponseError, networkError } from "./error";

export const apiBase = "/api";

export interface RequestOptions<Schema extends z.ZodType> {
  schema: Schema;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isAbortError(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && (cause as { name?: string }).name === "AbortError";
}

export async function requestJson<Schema extends z.ZodType>(
  path: string,
  options: RequestOptions<Schema>,
): Promise<z.infer<Schema>> {
  const hasBody = options.body !== undefined || options.form !== undefined;
  const token = apiConfig.getToken();
  const fastDemo = apiConfig.isFastDemo();
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fastDemo ? { "X-Fast-Demo": "1" } : {}),
        ...options.headers,
      },
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: options.signal,
    });
  } catch (cause) {
    if (isAbortError(cause)) throw cause;
    throw networkError();
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsedError = apiErrorBodySchema.safeParse(payload);
    if (parsedError.success) {
      const { code, message, retry } = parsedError.data.error;
      throw new ApiError(code, message, retry, response.status, payload);
    }
    throw new ApiError("http_error", `Request failed with status ${response.status}`, response.status >= 500, response.status, payload);
  }

  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) throw invalidResponseError();
  return parsed.data;
}
