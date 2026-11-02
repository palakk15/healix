export interface SseMessage {
  event: string;
  data: string;
}

export interface SseParser {
  feed: (chunk: string) => SseMessage[];
  flush: () => SseMessage[];
}

export function createSseParser(): SseParser {
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];

  const dispatch = (messages: SseMessage[]) => {
    if (dataLines.length > 0) messages.push({ event: eventName, data: dataLines.join("\n") });
    eventName = "message";
    dataLines = [];
  };

  const consumeLine = (line: string, messages: SseMessage[]) => {
    if (line === "") {
      dispatch(messages);
      return;
    }
    if (line.startsWith(":")) return;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") eventName = value;
    else if (field === "data") dataLines.push(value);
  };

  return {
    feed(chunk) {
      buffer += chunk;
      const messages: SseMessage[] = [];
      let newline = buffer.search(/\r\n|\n|\r/);
      while (newline !== -1) {
        const match = buffer.slice(newline).match(/^(\r\n|\n|\r)/);
        const length = match?.[0].length ?? 1;
        if (length === 1 && buffer[newline] === "\r" && newline + 1 === buffer.length) break;
        consumeLine(buffer.slice(0, newline), messages);
        buffer = buffer.slice(newline + length);
        newline = buffer.search(/\r\n|\n|\r/);
      }
      return messages;
    },
    flush() {
      const messages: SseMessage[] = [];
      if (buffer.length > 0) {
        consumeLine(buffer, messages);
        buffer = "";
      }
      dispatch(messages);
      return messages;
    },
  };
}

export async function* readSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const message of parser.feed(decoder.decode(value, { stream: true }))) yield message;
    }
    for (const message of parser.feed(decoder.decode())) yield message;
    for (const message of parser.flush()) yield message;
  } finally {
    reader.releaseLock();
  }
}
