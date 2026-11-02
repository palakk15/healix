import type { SarvamConfig } from "./config";
import { SarvamError, unavailable } from "./errors";
import { apiKeyHeader } from "./wire";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface SarvamTransport {
  fetch: FetchLike;
}

export const defaultTransport: SarvamTransport = { fetch: (input, init) => fetch(input, init) };

export async function callSarvam(
  config: SarvamConfig,
  transport: SarvamTransport,
  path: string,
  body: FormData | Record<string, unknown>,
): Promise<unknown> {
  if (!config.apiKey) throw unavailable();
  const isForm = body instanceof FormData;

  let response: Response;
  try {
    response = await transport.fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { [apiKeyHeader]: config.apiKey, Accept: "application/json", ...(isForm ? {} : { "Content-Type": "application/json" }) },
      body: isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (cause) {
    const name = typeof cause === "object" && cause !== null ? (cause as { name?: string }).name : undefined;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new SarvamError(504, "sarvam_timeout", "Sarvam took too long to answer", true);
    }
    if (process.env.NODE_ENV !== "test") console.warn(`Sarvam ${path} could not be reached (${cause instanceof Error ? cause.message : "network error"}). Check the internet connection.`);
    throw new SarvamError(502, "sarvam_unreachable", "Sarvam could not be reached", true);
  }

  if (response.status >= 400 && process.env.NODE_ENV !== "test") {
    const detail = await response
      .clone()
      .json()
      .then((payload: { error?: { message?: string }; message?: string }) => payload.error?.message ?? payload.message ?? "")
      .catch(() => "");
    console.warn(`Sarvam ${path} returned ${response.status}${detail ? `: ${String(detail).slice(0, 200)}` : ""}`);
  }

  if (response.status === 429) throw new SarvamError(429, "sarvam_rate_limited", "Sarvam is busy, please try again in a moment", true);
  if (response.status === 401 || response.status === 403) {
    throw new SarvamError(502, "sarvam_auth_failed", "Sarvam rejected the server credentials", false);
  }
  if (response.status >= 400 && response.status < 500) {
    throw new SarvamError(502, "sarvam_rejected_request", "Sarvam did not accept the request", false);
  }
  if (!response.ok) throw new SarvamError(502, "sarvam_failed", "Sarvam had a problem", true);

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new SarvamError(502, "sarvam_bad_response", "Sarvam sent an unreadable answer", true);
  }
}
