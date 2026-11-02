import { ApiError, apiErrorBodySchema, invalidResponseError, networkError } from "./error";
import { authHeaders } from "./config";
import { apiBase } from "./http";
import { assistantCitationsEventSchema, assistantDoneEventSchema, assistantRefusalEventSchema, assistantTokenEventSchema, type AssistantChatRequest, type Citation } from "./schemas/ai";
import { queueEventSchema, type QueueEvent } from "./schemas/backend";
import { readSseStream } from "./sse";

export interface AssistantHandlers {
  onToken: (text: string) => void;
  onCitations: (citations: Citation[]) => void;
  onRefusal: (message: string, reason?: string) => void;
  onDone: (envelope: { language: string; disclaimer?: string; model?: string }) => void;
}

function isAbort(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && (cause as { name?: string }).name === "AbortError";
}

async function openStream(path: string, init: { method: string; body?: unknown; signal?: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: init.method,
      headers: {
        Accept: "text/event-stream",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...authHeaders(),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch (cause) {
    if (isAbort(cause)) throw cause;
    throw networkError();
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const parsed = apiErrorBodySchema.safeParse(payload);
    if (parsed.success) throw new ApiError(parsed.data.error.code, parsed.data.error.message, parsed.data.error.retry, response.status, payload);
    throw new ApiError("http_error", `Request failed with status ${response.status}`, response.status >= 500, response.status, payload);
  }
  if (!response.body) throw invalidResponseError();
  return response.body;
}

export async function streamAssistantChat(request: AssistantChatRequest, handlers: AssistantHandlers, signal?: AbortSignal): Promise<void> {
  const body = await openStream("/ai/assistant/chat", { method: "POST", body: request, signal });
  for await (const message of readSseStream(body)) {
    let payload: unknown;
    try {
      payload = JSON.parse(message.data);
    } catch {
      continue;
    }
    if (message.event === "token") {
      const parsed = assistantTokenEventSchema.safeParse(payload);
      if (parsed.success) handlers.onToken(parsed.data.text);
    } else if (message.event === "citations") {
      const parsed = assistantCitationsEventSchema.safeParse(payload);
      if (parsed.success) handlers.onCitations(parsed.data);
    } else if (message.event === "refusal") {
      const parsed = assistantRefusalEventSchema.safeParse(payload);
      if (parsed.success) handlers.onRefusal(parsed.data.message, parsed.data.reason);
    } else if (message.event === "done") {
      const parsed = assistantDoneEventSchema.safeParse(payload);
      if (parsed.success) handlers.onDone({ language: parsed.data.language, disclaimer: parsed.data.disclaimer, model: parsed.data.model });
      return;
    }
  }
}

export interface EventStreamOptions {
  onEvent: (event: QueueEvent) => void;
  onStatus?: (status: "connected" | "reconnecting") => void;
  signal: AbortSignal;
  initialRetryMs?: number;
  maxRetryMs?: number;
}

export async function runEventStream(options: EventStreamOptions): Promise<void> {
  const maxRetry = options.maxRetryMs ?? 15_000;
  let retry = options.initialRetryMs ?? 1000;

  while (!options.signal.aborted) {
    try {
      const body = await openStream("/events/stream", { method: "GET", signal: options.signal });
      options.onStatus?.("connected");
      retry = options.initialRetryMs ?? 1000;
      for await (const message of readSseStream(body)) {
        if (message.event === "ready" || message.event === "ping") continue;
        let payload: unknown;
        try {
          payload = JSON.parse(message.data);
        } catch {
          continue;
        }
        const parsed = queueEventSchema.safeParse(payload);
        if (parsed.success) options.onEvent(parsed.data);
      }
    } catch (cause) {
      if (isAbort(cause) || options.signal.aborted) return;
    }
    if (options.signal.aborted) return;
    options.onStatus?.("reconnecting");
    await new Promise<void>((resolveWait) => {
      const timer = setTimeout(resolveWait, retry);
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolveWait();
      }, { once: true });
    });
    retry = Math.min(retry * 2, maxRetry);
  }
}
