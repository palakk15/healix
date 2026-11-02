import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ai, reports } from "@core/api/ai";
import { backend } from "@core/api/backend";
import { configureApi } from "@core/api/config";
import { ApiError } from "@core/api/error";
import { fetchMeta } from "@core/api/meta";
import { runEventStream, streamAssistantChat } from "@core/api/streams";
import type { QueueEvent } from "@core/api/schemas/backend";
import { normalizeFollowUps } from "@core/domain/triage";
import { createAppHandle, type AppHandle } from "../app";
import { loadEnv } from "../env";
import { noLatency } from "./routes";
import { MockWorld } from "./world";

let handle: AppHandle;
let token: string | undefined;
let fast = false;

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? undefined;
  if (signal?.aborted) throw abortError();
  const response = await handle.app.request(String(input), init);
  if (!signal || !response.body) return response;
  const source = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal.addEventListener(
        "abort",
        () => {
          controller.error(abortError());
          void source.cancel();
        },
        { once: true },
      );
    },
    async pull(controller) {
      const { done, value } = await source.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => source.cancel(reason),
  });
  return new Response(body, { status: response.status, headers: response.headers });
}

function routeFetchToApp() {
  vi.stubGlobal("fetch", appFetch);
}

beforeAll(() => {
  handle = createAppHandle(loadEnv({}), { world: new MockWorld(), latency: noLatency });
  routeFetchToApp();
  configureApi({ getToken: () => token, isFastDemo: () => fast });
});

afterEach(() => {
  routeFetchToApp();
  vi.useRealTimers();
});

describe("typed clients against the mock server", () => {
  it("fetches meta and surfaces wrong OTPs as ApiError with the shared fields", async () => {
    expect(await fetchMeta()).toEqual({ data_mode: "mock", sarvam_enabled: false, sarvam_mode: "mock", assistant_mode: "local" });
    const failure = await backend.login("9876500001", "999999").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: "invalid_otp", retry: false, status: 401 });
  });

  it("sends the bearer token automatically after login", async () => {
    const auth = await backend.login("9876500001", "123456");
    token = auth.access_token;
    expect((await backend.me()).name).toBe("Sunita Patil");
  });

  it("maps network failures and malformed responses to ApiError", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchMeta()).rejects.toMatchObject({ code: "network_error", retry: true });

    vi.stubGlobal("fetch", () => Promise.resolve(new Response(JSON.stringify({ data_mode: "sometimes" }), { status: 200 })));
    await expect(fetchMeta()).rejects.toMatchObject({ code: "invalid_response" });

    vi.stubGlobal("fetch", () => Promise.resolve(new Response("<html>bad gateway</html>", { status: 502 })));
    await expect(fetchMeta()).rejects.toMatchObject({ code: "http_error", retry: true, status: 502 });
  });

  it("runs the whole patient journey through the clients", async () => {
    const triage = await ai.triage({ text: "जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून", age: 58, sex: "female" });
    expect(triage.specialty).toBe("Gastroenterology");
    expect(normalizeFollowUps(triage.follow_up_questions, "mr")).toEqual([]);

    const user = await backend.me();
    const profileId = user.profiles[0]?.id ?? "";
    const match = await backend.match({ specialty: triage.specialty, urgency: triage.urgency, language: "mr", lat: 18.5, lng: 73.8077 });
    const top = match.items[0];
    expect(top?.doctor.id).toBe("doc_meera");

    const slots = await backend.slots("doc_meera");
    const firstFree = slots.days.flatMap((day) => day.slots).find((slot) => slot.available);
    const request = { doctor_id: "doc_meera", profile_id: profileId, slot_start: firstFree?.start ?? "" };

    const lost = await backend.book(request, "client-key-1");
    expect(lost.kind).toBe("slot_taken");
    if (lost.kind !== "slot_taken") return;
    expect(new Date(lost.nextFreeSlot).getTime()).toBeGreaterThan(new Date(request.slot_start).getTime());

    const won = await backend.book({ ...request, slot_start: lost.nextFreeSlot }, "client-key-2");
    expect(won.kind).toBe("booked");
    if (won.kind !== "booked") return;

    fast = true;
    const issued = await backend.issueToken(won.booking.booking_id);
    fast = false;
    expect(issued.label).toBe("A-23");
    expect((await backend.myTokens()).map((entry) => entry.id)).toEqual([issued.id]);
    expect((await backend.queue("doc_meera")).now_serving).toBe("A-18");

    const candidates = await backend.swapCandidates(issued.id);
    expect(candidates.candidates.length).toBeGreaterThan(0);
    const pending = await backend.createSwap(issued.id, candidates.candidates[0]?.id ?? "", "Could we swap, please?");
    expect(pending.state).toBe("pending");
    expect((await backend.cancelSwap(pending.id)).state).toBe("cancelled");
    const swapFailure = await backend.createSwap(issued.id, "tok_00001", "x").catch((error: unknown) => error);
    expect(swapFailure).toBeInstanceOf(ApiError);

    const uploaded = await reports.upload(profileId, new File([new Uint8Array([1, 2, 3])], "photo.jpg", { type: "image/jpeg" }));
    const job = await ai.processReport(uploaded.report_id);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2000);
    expect((await ai.job(job.job_id)).status).toBe("ready_for_review");
    vi.useRealTimers();

    await expect(ai.explain(uploaded.report_id, "mr")).rejects.toMatchObject({ code: "review_required", status: 409 });
    const report = await reports.get(uploaded.report_id);
    expect(report.observations.find((entry) => entry.code === "FBS")?.value).toBe(152);
    const confirmed = await reports.confirm(uploaded.report_id, [{ code: "FBS", value: 132 }]);
    expect(confirmed.status).toBe("confirmed");
    const explained = await ai.explain(uploaded.report_id, "mr");
    expect(explained.duplicates.length).toBe(2);
    expect((await reports.list(profileId)).length).toBe(3);
  });

  it("streams the assistant answer through typed handlers", async () => {
    const tokens: string[] = [];
    let done: { language: string } | undefined;
    await streamAssistantChat(
      { message: "HbA1c म्हणजे काय?", language: "mr" },
      {
        onToken: (text) => tokens.push(text),
        onCitations: () => {
          throw new Error("the report assistant sends no citations");
        },
        onRefusal: () => {
          throw new Error("should not refuse");
        },
        onDone: (envelope) => {
          done = envelope;
        },
      },
    );
    expect(tokens.join("")).toContain("HbA1c");
    expect(done?.language).toBe("mr");
  });

  it("delivers a refusal for the dose question and an error for an expired session", async () => {
    let refusal = "";
    await streamAssistantChat(
      { message: "How many metformin tablets should I take?" },
      { onToken: () => undefined, onCitations: () => undefined, onRefusal: (message) => (refusal = message), onDone: () => undefined },
    );
    expect(refusal).toBe("I can only answer doubts related to the report.");

    await expect(ai.answerTriage({ session_id: "sess_gone", answers: [{ question: "q", answer: "a" }] })).rejects.toMatchObject({ code: "session_not_found" });
  });

  it("aborts an assistant stream cleanly", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      streamAssistantChat({ message: "tell me about dengue" }, { onToken: () => undefined, onCitations: () => undefined, onRefusal: () => undefined, onDone: () => undefined }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("receives live queue events over SSE and stops when aborted", async () => {
    const controller = new AbortController();
    const received: QueueEvent[] = [];
    const statuses: string[] = [];
    const running = runEventStream({
      signal: controller.signal,
      onEvent: (event) => received.push(event),
      onStatus: (status) => statuses.push(status),
    });

    await vi.waitFor(() => expect(statuses).toContain("connected"));
    handle.world.engine.issueWalkIns("doc_arjun", 1);
    await vi.waitFor(() => expect(received.some((event) => event.type === "token_issued" && event.doctor_id === "doc_arjun")).toBe(true));
    const issued = received.find((event) => event.type === "token_issued");
    expect(issued?.label).toMatch(/^C-\d{2}$/);

    controller.abort();
    await running;
  });

  it("reconnects with backoff after the stream drops", async () => {
    const controller = new AbortController();
    const statuses: string[] = [];
    let attempts = 0;
    vi.stubGlobal("fetch", () => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new TypeError("offline"));
      return appFetch("/api/events/stream", { signal: controller.signal });
    });
    const running = runEventStream({ signal: controller.signal, onEvent: () => undefined, onStatus: (status) => statuses.push(status), initialRetryMs: 5, maxRetryMs: 10 });
    await vi.waitFor(() => expect(statuses).toEqual(["reconnecting", "connected"]));
    controller.abort();
    await running;
    expect(attempts).toBeGreaterThanOrEqual(2);
  });
});
