import { createServer } from "node:http";

const port = Number(process.env.FAKE_GROQ_PORT ?? 9911);
const expectedKey = process.env.FAKE_GROQ_KEY ?? "fake-key";

const server = createServer((request, response) => {
  if (request.headers.authorization !== `Bearer ${expectedKey}`) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "Invalid API Key" } }));
    return;
  }
  if (request.method === "GET" && request.url?.endsWith("/models")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "fake-model" }] }));
    return;
  }
  let raw = "";
  request.on("data", (chunk: Buffer) => (raw += chunk.toString()));
  request.on("end", () => {
    const body = JSON.parse(raw || "{}") as { messages?: Array<{ content?: string }> };
    const last = body.messages?.at(-1)?.content ?? "";
    const excerpt = /\[1\][^\n]*\n([^\n]+)/.exec(last)?.[1]?.slice(0, 80) ?? "";
    const reply = /cricket/i.test(last) ? "OFF_TOPIC" : `FAKE-GROQ saw the report: ${excerpt} [1]`;
    response.writeHead(200, { "content-type": "text/event-stream" });
    for (const word of reply.split(" ")) response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `${word} ` } }] })}\n\n`);
    response.end("data: [DONE]\n\n");
  });
});

server.listen(port, () => console.log(`fake groq on ${port}`));
