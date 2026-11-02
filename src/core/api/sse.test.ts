import { describe, expect, it } from "vitest";
import { createSseParser, readSseStream } from "./sse";

describe("SSE parser", () => {
  it("parses named events with data", () => {
    const parser = createSseParser();
    expect(parser.feed('event: token\ndata: {"text":"hi"}\n\n')).toEqual([{ event: "token", data: '{"text":"hi"}' }]);
  });

  it("handles messages split across chunks, including inside a line", () => {
    const parser = createSseParser();
    expect(parser.feed("event: tok")).toEqual([]);
    expect(parser.feed('en\ndata: {"a":')).toEqual([]);
    expect(parser.feed("1}\n\nevent: done\ndata: {}\n\n")).toEqual([
      { event: "token", data: '{"a":1}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("supports CRLF, comments, multi-line data and the default event name", () => {
    const parser = createSseParser();
    expect(parser.feed(": keep-alive\r\ndata: one\r\ndata: two\r\n\r\n")).toEqual([{ event: "message", data: "one\ntwo" }]);
  });

  it("waits for the next chunk when a chunk ends in a lone carriage return", () => {
    const parser = createSseParser();
    expect(parser.feed("data: a\r")).toEqual([]);
    expect(parser.feed("\n\r\n")).toEqual([{ event: "message", data: "a" }]);
  });

  it("ignores blocks without data and flushes a trailing message", () => {
    const parser = createSseParser();
    expect(parser.feed("event: ping\n\n")).toEqual([]);
    expect(parser.feed("event: done\ndata: {}")).toEqual([]);
    expect(parser.flush()).toEqual([{ event: "done", data: "{}" }]);
  });

  it("reads a ReadableStream including multi-byte characters split across chunks", async () => {
    const bytes = new TextEncoder().encode('event: token\ndata: {"text":"जळजळ"}\n\n');
    const cut = bytes.indexOf(0xa4) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });
    const messages = [];
    for await (const message of readSseStream(stream)) messages.push(message);
    expect(messages).toEqual([{ event: "token", data: '{"text":"जळजळ"}' }]);
  });
});
