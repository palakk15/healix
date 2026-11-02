import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ragAnswer, isSafeAnswer, type RagOptions } from "./assistant";
import { recursiveChunk } from "./chunker";
import { cosine, embed } from "./embedder";
import { GroqError, streamGroq, type GroqConfig, type GroqTransport } from "./groq";
import { VectorStore, type ReportDocument } from "./store";

const longText = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1} talks about haemoglobin and iron levels in the blood sample. It explains the range and what a low value can mean.`).join("\n\n");

const lipidReport: ReportDocument = {
  reportId: "rep_a",
  profileId: "pro_a",
  title: "Lipid profile · City Lab",
  issuedAtMs: Date.UTC(2026, 5, 1),
  text: "Lipid profile from City Lab, dated 2026-06-01.\n\nConfirmed results:\nLDL cholesterol: 162 mg/dL, reference up to 100 mg/dL, above the reference range. LDL is the cholesterol that can build up in blood vessels.\nHDL cholesterol: 48 mg/dL, reference from 40 mg/dL, within the reference range.",
};

const sugarReport: ReportDocument = {
  reportId: "rep_b",
  profileId: "pro_a",
  title: "Diabetes panel · Sun Lab",
  issuedAtMs: Date.UTC(2026, 6, 1),
  text: "Diabetes panel from Sun Lab, dated 2026-07-01.\n\nConfirmed results:\nHbA1c: 7.9 %, reference up to 5.6 %, above the reference range. HbA1c shows the average blood sugar over about three months.",
};

const groq: GroqConfig = { apiKey: "test-key", baseUrl: "https://groq.test/v1", model: "test-model", timeoutMs: 2000 };

function sse(pieces: string[]): Response {
  const body = pieces.map((piece) => `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const baseOptions: RagOptions = { requestId: "req_1", wordDelayMs: 0, sleep: async () => undefined };

async function collect(generator: AsyncGenerator<{ event: string; data: unknown }>) {
  const events: Array<{ event: string; data: unknown }> = [];
  for await (const event of generator) events.push(event);
  return events;
}

function textOf(events: Array<{ event: string; data: unknown }>): string {
  return events
    .filter((event) => event.event === "token")
    .map((event) => (event.data as { text: string }).text)
    .join("");
}

describe("recursive chunker", () => {
  it("keeps every chunk near the size limit and keeps the order", () => {
    const chunks = recursiveChunk(longText, { chunkSize: 300, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(300);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
    expect(chunks[0]?.text.startsWith("Paragraph 1")).toBe(true);
  });

  it("prefers paragraph breaks, then sentences, then words", () => {
    const paragraphs = recursiveChunk("First paragraph here.\n\nSecond paragraph here.", { chunkSize: 25, overlap: 0 });
    expect(paragraphs.map((chunk) => chunk.text)).toEqual(["First paragraph here.", "Second paragraph here."]);
    const sentences = recursiveChunk("One sentence is here. Another sentence is here.", { chunkSize: 25, overlap: 0 });
    expect(sentences).toHaveLength(2);
    const hardWords = recursiveChunk("word ".repeat(40), { chunkSize: 30, overlap: 0 });
    for (const chunk of hardWords) expect(chunk.text.length).toBeLessThanOrEqual(30);
  });

  it("splits a single unbroken string at the character level", () => {
    const chunks = recursiveChunk("x".repeat(95), { chunkSize: 40, overlap: 0 });
    expect(chunks.map((chunk) => chunk.text.length)).toEqual([40, 40, 15]);
  });

  it("adds overlap from the end of the previous chunk", () => {
    const chunks = recursiveChunk(longText, { chunkSize: 300, overlap: 50 });
    const first = chunks[0]?.text ?? "";
    const second = chunks[1]?.text ?? "";
    const tail = first.slice(-20).trim().split(" ").slice(-2).join(" ");
    expect(second.includes(tail)).toBe(true);
  });

  it("returns nothing for blank text and one chunk for short text", () => {
    expect(recursiveChunk("   \n\n ")).toEqual([]);
    expect(recursiveChunk("Short report.")).toEqual([{ index: 0, text: "Short report." }]);
  });
});

describe("embedder", () => {
  it("gives unit vectors and ranks related text higher than unrelated text", () => {
    const query = embed("what does my LDL cholesterol mean");
    expect(Math.hypot(...query)).toBeCloseTo(1, 2);
    const related = cosine(query, embed("LDL cholesterol is above the reference range"));
    const unrelated = cosine(query, embed("the cricket match was played in Mumbai yesterday"));
    expect(related).toBeGreaterThan(unrelated + 0.2);
  });

  it("treats sugar and glucose, and hba1c spellings, as the same idea", () => {
    expect(cosine(embed("sugar"), embed("glucose"))).toBeGreaterThan(0.9);
    expect(cosine(embed("A1c"), embed("HbA1c"))).toBeGreaterThan(0.9);
  });
});

describe("vector store", () => {
  it("indexes documents, finds the right one and filters by profile", () => {
    const store = new VectorStore();
    store.sync([lipidReport, sugarReport, { ...sugarReport, reportId: "rep_c", profileId: "pro_other" }]);
    const hits = store.search("what is my cholesterol", { profileIds: ["pro_a"] });
    expect(hits[0]?.chunk.reportId).toBe("rep_a");
    expect(hits.every((hit) => hit.chunk.profileId === "pro_a")).toBe(true);
    expect(store.search("average blood sugar", { profileIds: ["pro_a"] })[0]?.chunk.reportId).toBe("rep_b");
    expect(store.countFor(["pro_nobody"])).toBe(0);
  });

  it("re-indexes only when the text changes and drops removed reports", () => {
    const store = new VectorStore();
    expect(store.upsert(lipidReport)).toBeGreaterThan(0);
    expect(store.upsert(lipidReport)).toBe(0);
    expect(store.upsert({ ...lipidReport, text: `${lipidReport.text}\nTriglycerides: 140 mg/dL.` })).toBeGreaterThan(0);
    store.sync([sugarReport]);
    expect(store.has("rep_a")).toBe(false);
    expect(store.has("rep_b")).toBe(true);
  });

  it("persists to disk and reloads", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "healix-vectors-"));
    try {
      const file = resolve(directory, "vectors.json");
      const first = new VectorStore(file);
      first.sync([lipidReport, sugarReport]);
      const reloaded = new VectorStore(file);
      expect(reloaded.size).toBe(first.size);
      expect(reloaded.has("rep_a")).toBe(true);
      expect(reloaded.upsert(lipidReport)).toBe(0);
      expect(reloaded.search("cholesterol", { profileIds: ["pro_a"] })[0]?.chunk.reportId).toBe("rep_a");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("groq client", () => {
  it("streams text pieces and sends the key and model", async () => {
    let seen: { url: string; headers: Record<string, string>; body: { model: string; stream: boolean } } | undefined;
    const transport: GroqTransport = async (url, init) => {
      seen = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
      return sse(["Hello", " there"]);
    };
    const pieces: string[] = [];
    for await (const piece of streamGroq(groq, [{ role: "user", content: "hi" }], transport)) pieces.push(piece);
    expect(pieces).toEqual(["Hello", " there"]);
    expect(seen?.url).toBe("https://groq.test/v1/chat/completions");
    expect(seen?.headers.authorization).toBe("Bearer test-key");
    expect(seen?.body).toMatchObject({ model: "test-model", stream: true });
  });

  it("raises a GroqError for HTTP errors and network failures", async () => {
    const failing: GroqTransport = async () => new Response("no", { status: 401 });
    await expect(async () => {
      for await (const piece of streamGroq(groq, [], failing)) void piece;
    }).rejects.toBeInstanceOf(GroqError);
    const offline: GroqTransport = async () => {
      throw new TypeError("offline");
    };
    await expect(async () => {
      for await (const piece of streamGroq(groq, [], offline)) void piece;
    }).rejects.toBeInstanceOf(GroqError);
  });
});

describe("report assistant", () => {
  const input = (message: string, extra: Partial<Parameters<typeof ragAnswer>[1]> = {}) => ({
    message,
    language: "en",
    documents: [lipidReport, sugarReport],
    profileIds: ["pro_a"],
    observations: [],
    ...extra,
  });

  it("answers from the report with citations when Groq is connected", async () => {
    let prompt = "";
    const transport: GroqTransport = async (_url, init) => {
      prompt = JSON.stringify(JSON.parse(String(init.body)).messages);
      return sse(["Your LDL is above the printed range [1]. ", "Please talk to your doctor."]);
    };
    const events = await collect(ragAnswer(new VectorStore(), input("Is my LDL cholesterol high?"), { ...baseOptions, groq, transport }));
    expect(events.map((event) => event.event)).toEqual(["citations", ...Array(textOf(events).split(/(?<=\s)/).length).fill("token"), "done"]);
    expect(textOf(events)).toContain("above the printed range [1]");
    const citations = events[0]?.data as Array<{ n: number; excerpt?: string; url: string }>;
    expect(citations[0]?.url).toBe("/app/reports/rep_a");
    expect(citations[0]?.excerpt).toContain("LDL");
    expect(prompt).toContain("LDL cholesterol: 162 mg/dL");
    expect((events.at(-1)?.data as { model: string }).model).toBe("test-model");
  });

  it("refuses medicine questions without calling Groq, and shows the fixed sentence when Groq says it is off topic", async () => {
    let calls = 0;
    const transport: GroqTransport = async () => {
      calls += 1;
      return sse(["OFF_TOPIC"]);
    };
    const medicine = await collect(ragAnswer(new VectorStore(), input("How many metformin tablets should I take?"), { ...baseOptions, groq, transport }));
    expect(medicine.map((event) => event.event)).toEqual(["refusal", "done"]);
    expect(calls).toBe(0);
    const cricket = await collect(ragAnswer(new VectorStore(), input("Who won the cricket match?"), { ...baseOptions, groq, transport }));
    expect(cricket.map((event) => event.event)).toEqual(["refusal", "done"]);
    expect((cricket[0]?.data as { message: string }).message).toBe("I can only answer doubts related to the report.");
    expect(calls).toBe(1);
  });

  it("lets Groq answer follow-up questions that share no words with the report", async () => {
    const transport: GroqTransport = async () => sse(["A diet question is best discussed with your doctor, who can see the whole report."]);
    const events = await collect(ragAnswer(new VectorStore(), input("Can I eat sweets with this?"), { ...baseOptions, groq, transport }));
    expect(textOf(events)).toContain("doctor");
  });

  it("retries once when the first Groq answer is unsafe, and reports why Groq was skipped", async () => {
    const replies = ["You have diabetes.", "Your HbA1c is above the printed range [1]."];
    const transport: GroqTransport = async () => sse([replies.shift() ?? "You have diabetes."]);
    const events = await collect(ragAnswer(new VectorStore(), input("Is my HbA1c high?"), { ...baseOptions, groq, transport }));
    expect(textOf(events)).toContain("above the printed range");
    const problems: string[] = [];
    const alwaysUnsafe: GroqTransport = async () => sse(["You have diabetes."]);
    await collect(ragAnswer(new VectorStore(), input("Is my HbA1c high?"), { ...baseOptions, groq, transport: alwaysUnsafe, onGroqProblem: (reason) => problems.push(reason) }));
    expect(problems.length).toBe(2);
    const offline: GroqTransport = async () => new Response("no", { status: 401 });
    await collect(ragAnswer(new VectorStore(), input("Is my HbA1c high?"), { ...baseOptions, groq, transport: offline, onGroqProblem: (reason) => problems.push(reason) }));
    expect(problems.at(-1)).toContain("401");
  });

  it("explains general terms with Groq when no report has been uploaded yet", async () => {
    let prompt = "";
    const transport: GroqTransport = async (_url, init) => {
      prompt = String(init.body);
      return sse(["HbA1c shows average blood sugar over about three months."]);
    };
    const events = await collect(ragAnswer(new VectorStore(), input("What does HbA1c mean?", { documents: [] }), { ...baseOptions, groq, transport }));
    expect(textOf(events)).toContain("three months");
    expect(prompt).toContain("has not uploaded a confirmed report");
    expect(events.map((event) => event.event)).not.toContain("citations");
  });

  it("falls back to the built-in answer when Groq fails or answers unsafely", async () => {
    const down: GroqTransport = async () => new Response("bad", { status: 500 });
    const unsafe: GroqTransport = async () => sse(["You have diabetes. Take 500 mg tablets."]);
    for (const transport of [down, unsafe]) {
      const events = await collect(ragAnswer(new VectorStore(), input("What does HbA1c mean?"), { ...baseOptions, groq, transport }));
      expect(events.at(-1)?.event).toBe("done");
      const text = textOf(events);
      expect(text.length).toBeGreaterThan(20);
      expect(isSafeAnswer(text)).toBe(true);
      expect(text).not.toContain("500 mg");
    }
  });

  it("works without any Groq key, quoting the report for terms it has no glossary entry for", async () => {
    const events = await collect(ragAnswer(new VectorStore(), input("What does the Sun Lab diabetes panel say?"), baseOptions));
    expect(events.map((event) => event.event)).toContain("citations");
    expect(textOf(events)).toContain("[1]");
    expect(textOf(events)).toContain("HbA1c");
  });

  it("without Groq and without a report, still explains terms from the glossary and refuses other topics", async () => {
    const term = await collect(ragAnswer(new VectorStore(), input("What does HbA1c mean?", { documents: [] }), baseOptions));
    expect(term.map((event) => event.event)).not.toContain("refusal");
    expect(textOf(term).length).toBeGreaterThan(30);
    const other = await collect(ragAnswer(new VectorStore(), input("Who won the cricket match?", { documents: [] }), baseOptions));
    expect((other[0]?.data as { reason: string }).reason).toBe("off_topic");
    const summary = await collect(ragAnswer(new VectorStore(), input("Explain my report in simple words", { documents: [] }), baseOptions));
    expect(textOf(summary)).toContain("confirmed report");
  });

  it("flags unsafe wording and doses", () => {
    expect(isSafeAnswer("Your HbA1c is above the range. Ask your doctor.")).toBe(true);
    expect(isSafeAnswer("Glucose is 132 mg/dL against a range up to 99 mg/dL.")).toBe(true);
    expect(isSafeAnswer("You have diabetes")).toBe(false);
    expect(isSafeAnswer("If you have any questions, ask your doctor.")).toBe(true);
    expect(isSafeAnswer("Take 500 mg twice")).toBe(false);
  });
});

describe("groq request for reasoning models", () => {
  it("asks gpt-oss models for low reasoning effort and a roomy answer budget, and hides think tags", async () => {
    let sent: { reasoning_effort?: string; max_tokens: number } = { max_tokens: 0 };
    const transport: GroqTransport = async (_url, init) => {
      sent = JSON.parse(String(init.body));
      return sse(["<think>hidden</think>", "Visible answer."]);
    };
    const { completeGroq } = await import("./groq");
    const text = await completeGroq({ ...groq, model: "openai/gpt-oss-120b" }, [{ role: "user", content: "hi" }], transport);
    expect(sent.reasoning_effort).toBe("low");
    expect(sent.max_tokens).toBeGreaterThanOrEqual(1500);
    expect(text).toBe("Visible answer.");
    await completeGroq({ ...groq, model: "other-model" }, [{ role: "user", content: "hi" }], async (_u, init) => {
      sent = JSON.parse(String(init.body));
      return sse(["ok"]);
    });
    expect(sent.reasoning_effort).toBeUndefined();
  });
});

describe("small talk", () => {
  const ask = (message: string, language = "en") =>
    collect(ragAnswer(new VectorStore(), { message, language, documents: [], profileIds: ["pro_a"], observations: [] }, { ...baseOptions, groq, transport: async () => sse(["OFF_TOPIC"]) }));

  it("answers greetings, thanks, goodbyes and what-can-you-do without calling Groq and without refusing", async () => {
    for (const message of ["hi", "Hello!", "hey there", "Good morning", "thanks", "thank you so much", "bye", "what can you do?", "who are you"]) {
      const events = await ask(message);
      expect(events.map((event) => event.event), message).not.toContain("refusal");
      expect(textOf(events).length, message).toBeGreaterThan(20);
    }
    expect(textOf(await ask("hi"))).toContain("Healix AI");
    expect(textOf(await ask("नमस्ते", "hi"))).toContain("Healix AI");
    expect(textOf(await ask("namaste", "hinglish"))).toContain("Healix AI");
  });

  it("does not treat a real question that starts with hi as small talk", async () => {
    const events = await ask("hi what does HbA1c mean");
    expect(events.map((event) => event.event)).toContain("done");
    expect(textOf(events)).not.toContain("I am Healix AI");
  });
});
