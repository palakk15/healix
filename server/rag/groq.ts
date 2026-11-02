export interface GroqConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type GroqTransport = (url: string, init: RequestInit) => Promise<Response>;

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function* streamGroq(config: GroqConfig, messages: GroqMessage[], transport: GroqTransport = fetch): AsyncGenerator<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response: Response;
  try {
    response = await transport(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 2000,
        ...(/gpt-oss/i.test(config.model) ? { reasoning_effort: "low" } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw new GroqError(error instanceof Error ? error.message : "request failed");
  }
  if (!response.ok || !response.body) {
    clearTimeout(timer);
    const detail = await response
      .json()
      .then((payload: { error?: { message?: string } }) => payload.error?.message ?? "")
      .catch(() => "");
    throw new GroqError(`Groq returned ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`, response.status);
  }
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const piece = parsed.choices?.[0]?.delta?.content;
          if (piece) yield piece;
        } catch {
          continue;
        }
      }
    }
  } catch (error) {
    throw new GroqError(error instanceof Error ? error.message : "stream failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function completeGroq(config: GroqConfig, messages: GroqMessage[], transport?: GroqTransport): Promise<string> {
  let text = "";
  for await (const piece of streamGroq(config, messages, transport)) text += piece;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
