import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  assistantDoneEventSchema,
  assistantCitationsEventSchema,
  assistantRefusalEventSchema,
  diagnosticReportSchema,
  explainResponseSchema,
  jobResponseSchema,
  processReportResponseSchema,
  reportListItemSchema,
  triageResponseSchema,
  uploadReportResponseSchema,
} from "@core/api/schemas/ai";
import {
  accuracySchema,
  analyticsSchema,
  authResponseSchema,
  bestTimesSchema,
  bookingModesSchema,
  bookingSchema,
  consentSchema,
  dashboardDoctorsSchema,
  dashboardOverviewSchema,
  emergencyResponseSchema,
  matchResponseSchema,
  nearestEmergencySchema,
  preAlertsSchema,
  queueSchema,
  slotsResponseSchema,
  slotTakenSchema,
  swapCandidatesSchema,
  swapRequestSchema,
  tokenSchema,
  type QueueEvent,
} from "@core/api/schemas/backend";
import { adviseLeaveTime } from "@core/domain/leaveTime";
import { readSseStream } from "@core/api/sse";
import { createAppHandle, type AppHandle } from "../app";
import { loadEnv } from "../env";
import { noLatency } from "./routes";
import { MockWorld } from "./world";

const sunita = { lat: 18.5, lng: 73.8077 };

interface CallOptions {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

function makeClient(handle: AppHandle) {
  async function raw(method: string, path: string, options: CallOptions = {}): Promise<Response> {
    return handle.app.request(`/api${path}`, {
      method,
      headers: {
        ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  }
  async function call(method: string, path: string, options: CallOptions = {}) {
    const response = await raw(method, path, options);
    const text = await response.text();
    return { status: response.status, json: (text ? JSON.parse(text) : null) as unknown };
  }
  async function login(phone: string) {
    const { json } = await call("POST", "/auth/login", { body: { phone, otp: "123456" } });
    return authResponseSchema.parse(json);
  }
  return { raw, call, login };
}

function newHandle(): AppHandle {
  return createAppHandle(loadEnv({}), { world: new MockWorld(), latency: noLatency });
}

describe("auth, consent and guards", () => {
  const handle = newHandle();
  const { call, login } = makeClient(handle);

  it("serves meta and health", async () => {
    expect((await call("GET", "/health")).json).toEqual({ ok: true });
    expect((await call("GET", "/meta")).json).toEqual({ data_mode: "mock", sarvam_enabled: false, sarvam_mode: "mock", assistant_mode: "local" });
  });

  it("rejects a wrong OTP and an unknown phone with the shared error shape", async () => {
    const wrong = await call("POST", "/auth/login", { body: { phone: "9876500001", otp: "000000" } });
    expect(wrong.status).toBe(401);
    expect(wrong.json).toEqual({ error: { code: "invalid_otp", message: "That code is not correct", retry: false } });
    const unknown = await call("POST", "/auth/login", { body: { phone: "9999999999", otp: "123456" } });
    expect(unknown.status).toBe(404);
  });

  it("logs Sunita in with her two family profiles", async () => {
    const auth = await login("9876500001");
    expect(auth.user.name).toBe("Sunita Patil");
    expect(auth.user.profiles.map((profile) => profile.name)).toEqual(["Sunita Patil", "Shanta Joshi"]);
    expect(auth.user.profiles[1]?.elder_mode).toBe(true);
  });

  it("registers a new patient", async () => {
    const created = await call("POST", "/auth/register", { body: { phone: "9123456780", name: "Test Person" } });
    expect(created.status).toBe(201);
    expect(authResponseSchema.parse(created.json).user.profiles).toHaveLength(1);
    expect((await call("POST", "/auth/register", { body: { phone: "9123456780" } })).status).toBe(409);
  });

  it("requires a token on protected routes", async () => {
    const response = await call("GET", "/me");
    expect(response.status).toBe(401);
    expect((response.json as { error: { code: string } }).error.code).toBe("unauthorized");
  });

  it("starts with nothing consented and supports grant, list and revoke", async () => {
    const { access_token: token } = await login("9876500001");
    expect(((await call("GET", "/consent", { token })).json as { consents: unknown[] }).consents).toEqual([]);
    const granted = await call("POST", "/consent", { token, body: { purpose: "voice", granted: true } });
    expect(consentSchema.parse(granted.json).granted).toBe(true);
    const list = (await call("GET", "/consent", { token })).json as { consents: Array<{ id: string }> };
    expect(list.consents).toHaveLength(1);
    const id = list.consents[0]?.id ?? "";
    expect((await call("DELETE", `/consent/${id}`, { token })).status).toBe(200);
    expect(((await call("GET", "/consent", { token })).json as { consents: unknown[] }).consents).toEqual([]);
    expect((await call("DELETE", `/consent/${id}`, { token })).status).toBe(404);
  });

  it("keeps patients out of staff areas", async () => {
    const { access_token: token } = await login("9876500001");
    expect((await call("GET", "/dashboard/overview", { token })).status).toBe(403);
    expect((await call("GET", "/dashboard/overview")).status).toBe(401);
  });

  it("returns a 404 error body for unknown routes", async () => {
    const response = await call("GET", "/definitely-not-a-route");
    expect(response.status).toBe(404);
  });
});

describe("the scripted demo: triage, match, booking race, token, swaps", () => {
  const handle = newHandle();
  const { call, login } = makeClient(handle);
  const state: {
    token: string;
    profileId: string;
    firstSlot: string;
    nextFree: string;
    bookingId: string;
    tokenId: string;
    walkInToken: string;
  } = { token: "", profileId: "", firstSlot: "", nextFree: "", bookingId: "", tokenId: "", walkInToken: "" };
  const events: QueueEvent[] = [];

  beforeAll(async () => {
    const auth = await login("9876500001");
    state.token = auth.access_token;
    state.profileId = auth.user.profiles[0]?.id ?? "";
    handle.world.subscribe((event) => events.push(event as QueueEvent));
  });

  afterAll(() => vi.useRealTimers());

  it("step 1: the Marathi phrase triages to Gastroenterology, soon", async () => {
    const response = await call("POST", "/ai/triage", {
      token: state.token,
      body: { text: "जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून", age: 58, sex: "female", conditions: ["Type 2 diabetes"] },
    });
    expect(response.status).toBe(200);
    const result = triageResponseSchema.parse(response.json);
    expect(result).toMatchObject({ specialty: "Gastroenterology", urgency: "soon", language: "mr" });
    expect(result.red_flags).toEqual([]);
    expect(result.request_id).toBeTruthy();
  });

  it("step 2: the top pick speaks Marathi, is 2.1 km away and about 25 minutes", async () => {
    const response = await call("POST", "/match", {
      token: state.token,
      body: { specialty: "Gastroenterology", urgency: "soon", language: "mr", ...sunita },
    });
    const result = matchResponseSchema.parse(response.json);
    const top = result.items[0];
    expect(top?.doctor.id).toBe("doc_meera");
    expect(top?.doctor.languages).toContain("Marathi");
    expect(top?.doctor.distance_km).toBe(2.1);
    expect(top?.predicted_wait.wait_minutes).toBe(25);
    expect(top?.predicted_wait.range_low).toBeLessThan(25);
    expect(top?.predicted_wait.range_high).toBeGreaterThan(25);
    expect(top?.why).toMatch(/^Speaks Marathi, 2\.1 km away/);
    expect(result.items.length).toBeLessThanOrEqual(5);
    const scores = result.items.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("applies the max fee and distance filters", async () => {
    const response = await call("POST", "/match", {
      token: state.token,
      body: { specialty: "Gastroenterology", urgency: "soon", language: "mr", ...sunita, max_fee: 600 },
    });
    const items = matchResponseSchema.parse(response.json).items;
    expect(items.every((item) => item.doctor.fee_inr <= 600)).toBe(true);
    const near = await call("POST", "/match", {
      token: state.token,
      body: { specialty: "Gastroenterology", urgency: "soon", language: "mr", ...sunita, max_km: 3 },
    });
    expect(matchResponseSchema.parse(near.json).items.every((item) => (item.doctor.distance_km ?? 99) <= 3)).toBe(true);
  });

  it("returns three best times with minutes saved", async () => {
    const response = await call("GET", "/doctors/doc_meera/best-times", { token: state.token });
    const times = bestTimesSchema.parse(response.json).times;
    expect(times).toHaveLength(3);
    expect(times.every((entry) => entry.minutes_saved >= 0)).toBe(true);
  });

  it("step 2b: the first booking attempt loses the race with a 409 and a next free slot", async () => {
    const slots = slotsResponseSchema.parse((await call("GET", "/doctors/doc_meera/slots", { token: state.token })).json);
    const available = slots.days.flatMap((day) => day.slots).filter((slot) => slot.available);
    state.firstSlot = available[0]?.start ?? "";
    expect(state.firstSlot).not.toBe("");

    const attempt = await call("POST", "/bookings", {
      token: state.token,
      headers: { "idempotency-key": "key-1" },
      body: { doctor_id: "doc_meera", profile_id: state.profileId, slot_start: state.firstSlot },
    });
    expect(attempt.status).toBe(409);
    const conflict = slotTakenSchema.parse(attempt.json);
    expect(conflict.error).toMatchObject({ code: "slot_taken", retry: true });
    expect(new Date(conflict.next_free_slot).getTime()).toBeGreaterThan(new Date(state.firstSlot).getTime());
    state.nextFree = conflict.next_free_slot;

    const replay = await call("POST", "/bookings", {
      token: state.token,
      headers: { "idempotency-key": "key-1" },
      body: { doctor_id: "doc_meera", profile_id: state.profileId, slot_start: state.firstSlot },
    });
    expect(replay.status).toBe(409);
    expect(replay.json).toEqual(attempt.json);
  });

  it("requires an idempotency key", async () => {
    const response = await call("POST", "/bookings", {
      token: state.token,
      body: { doctor_id: "doc_meera", profile_id: state.profileId, slot_start: state.nextFree },
    });
    expect(response.status).toBe(400);
    expect((response.json as { error: { code: string } }).error.code).toBe("idempotency_key_required");
  });

  it("step 2c: rebooking the next free slot succeeds, and repeating the key returns the same booking", async () => {
    const request = {
      token: state.token,
      headers: { "idempotency-key": "key-2" },
      body: { doctor_id: "doc_meera", profile_id: state.profileId, slot_start: state.nextFree },
    };
    const booked = await call("POST", "/bookings", request);
    expect(booked.status).toBe(201);
    const booking = bookingSchema.parse(booked.json);
    state.bookingId = booking.booking_id;
    const repeated = await call("POST", "/bookings", request);
    expect(repeated.json).toEqual(booked.json);
  });

  it("does not let two people take the same slot", async () => {
    const other = await login("9876500002");
    const taken = await call("POST", "/bookings", {
      token: other.access_token,
      headers: { "idempotency-key": "other-1" },
      body: { doctor_id: "doc_meera", profile_id: other.user.profiles[0]?.id ?? "", slot_start: state.nextFree },
    });
    expect(taken.status).toBe(409);
  });

  it("step 3: the token is A-23 with 53 minutes predicted, so leave home in 25", async () => {
    const issued = await call("POST", "/tokens", { token: state.token, body: { booking_id: state.bookingId } });
    expect(issued.status).toBe(201);
    const token = tokenSchema.parse(issued.json);
    state.tokenId = token.id;
    expect(token.label).toBe("A-23");
    expect(token.ahead).toBe(5);
    expect(token.now_serving).toBe("A-18");
    expect(token.predicted_wait.wait_minutes).toBe(53);
    expect(token.predicted_wait.range_low).toBe(47);
    expect(token.predicted_wait.range_high).toBe(59);
    expect(token.predicted_wait.reasons.map((reason) => [reason.code, reason.minutes])).toEqual([
      ["morning_rush", 12],
      ["doctor_late", 8],
      ["quick_followups", -6],
    ]);
    expect(token.travel_minutes).toBe(18);
    const advice = adviseLeaveTime(token.server_time, token.predicted_wait.wait_minutes, token.travel_minutes);
    expect(advice.leaveInMinutes).toBe(25);
    expect(token.predicted_wait.suggested_arrival).toBe(advice.arriveByIso);
  });

  it("returns the same token when issued twice for one booking", async () => {
    const again = await call("POST", "/tokens", { token: state.token, body: { booking_id: state.bookingId } });
    expect(tokenSchema.parse(again.json).id).toBe(state.tokenId);
  });

  it("only shows a token to its owner", async () => {
    const other = await login("9876500002");
    expect((await call("GET", `/tokens/${state.tokenId}`, { token: other.access_token })).status).toBe(403);
    const mine = (await call("GET", "/tokens/mine", { token: state.token })).json as { tokens: Array<{ id: string }> };
    expect(mine.tokens.map((entry) => entry.id)).toEqual([state.tokenId]);
  });

  it("reports the live queue", async () => {
    const queue = queueSchema.parse((await call("GET", "/queue/doc_meera")).json);
    expect(queue.now_serving).toBe("A-18");
    expect(queue.length).toBeGreaterThanOrEqual(6);
    expect(queue.delay_minutes).toBe(8);
  });

  it("step 3b: an incoming swap request appears, and accepting it updates the numbers live", async () => {
    const before = (await call("GET", "/swap-requests/incoming", { token: state.token })).json as { requests: unknown[] };
    expect(before.requests).toEqual([]);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 21_000);

    const incoming = (await call("GET", "/swap-requests/incoming", { token: state.token })).json as { requests: unknown[] };
    expect(incoming.requests).toHaveLength(1);
    const request = swapRequestSchema.parse(incoming.requests[0]);
    expect(request).toMatchObject({ state: "pending", from_token: { label: "A-24" }, to_token: { label: "A-23" } });
    expect(JSON.stringify(request)).not.toMatch(/Sunita|Patil|Shanta/);
    expect(new Date(request.expires_at).getTime() - new Date(request.created_at).getTime()).toBe(5 * 60_000);

    const accepted = await call("POST", `/swap-requests/${request.id}/accept`, { token: state.token });
    expect(swapRequestSchema.parse(accepted.json).state).toBe("accepted");
    expect(events.some((event) => event.type === "swap_accepted" && event.token_ids?.includes(state.tokenId))).toBe(true);

    const after = tokenSchema.parse((await call("GET", `/tokens/${state.tokenId}`, { token: state.token })).json);
    expect(after.label).toBe("A-24");
    expect(after.ahead).toBe(6);
    expect(after.predicted_wait.wait_minutes).toBeGreaterThan(53);

    const frozen = swapRequestSchema.parse(((await call("GET", "/swap-requests/incoming", { token: state.token })).json as { requests: unknown[] }).requests[0] ?? accepted.json);
    expect(frozen).toMatchObject({ from_token: { label: "A-24" }, to_token: { label: "A-23" } });
    const again = await call("POST", `/swap-requests/${request.id}/accept`, { token: state.token });
    expect(again.status).toBe(409);
    vi.useRealTimers();
  });

  it("enforces the swap rules: ahead only, one pending at a time, three requests maximum", async () => {
    const candidates = swapCandidatesSchema.parse((await call("GET", `/tokens/${state.tokenId}/swap-candidates`, { token: state.token })).json);
    expect(candidates.max_requests).toBe(3);
    expect(candidates.candidates.length).toBeGreaterThanOrEqual(3);
    const mineNumber = tokenSchema.parse((await call("GET", `/tokens/${state.tokenId}`, { token: state.token })).json).number;
    for (const candidate of candidates.candidates) {
      const number = Number(candidate.label.split("-")[1]);
      expect(number).toBeLessThan(mineNumber);
    }

    const first = candidates.candidates[0];
    const second = candidates.candidates[1];
    const third = candidates.candidates[2];
    const behind = await call("POST", `/tokens/${state.tokenId}/swap-requests`, {
      token: state.token,
      body: { to_token_id: state.walkInToken || "tok_00001", message: "please" },
    });
    expect([400, 403]).toContain(behind.status);

    const created = await call("POST", `/tokens/${state.tokenId}/swap-requests`, {
      token: state.token,
      body: { to_token_id: first?.id, message: "Could we swap, please?" },
    });
    expect(created.status).toBe(201);
    const pending = swapRequestSchema.parse(created.json);
    expect(pending.state).toBe("pending");

    const concurrent = await call("POST", `/tokens/${state.tokenId}/swap-requests`, {
      token: state.token,
      body: { to_token_id: second?.id, message: "second" },
    });
    expect(concurrent.status).toBe(409);
    expect((concurrent.json as { error: { code: string } }).error.code).toBe("swap_pending");

    expect(swapRequestSchema.parse((await call("DELETE", `/swap-requests/${pending.id}`, { token: state.token })).json).state).toBe("cancelled");

    for (const target of [second, third]) {
      const next = await call("POST", `/tokens/${state.tokenId}/swap-requests`, {
        token: state.token,
        body: { to_token_id: target?.id, message: "again" },
      });
      expect(next.status).toBe(201);
      await call("DELETE", `/swap-requests/${swapRequestSchema.parse(next.json).id}`, { token: state.token });
    }

    const fourth = await call("POST", `/tokens/${state.tokenId}/swap-requests`, {
      token: state.token,
      body: { to_token_id: first?.id, message: "one more" },
    });
    expect(fourth.status).toBe(429);
    expect((fourth.json as { error: { code: string } }).error.code).toBe("swap_limit_reached");
  });
});

describe("swap requests that expire or resolve on their own", () => {
  it("expires after five minutes and walk-ins answer automatically", async () => {
    const handle = newHandle();
    const { call, login } = makeClient(handle);
    const auth = await login("9876500001");
    const token = auth.access_token;
    const profileId = auth.user.profiles[0]?.id ?? "";
    const slots = slotsResponseSchema.parse((await call("GET", "/doctors/doc_meera/slots", { token })).json);
    const free = slots.days.flatMap((day) => day.slots).filter((slot) => slot.available);
    await call("POST", "/bookings", { token, headers: { "idempotency-key": "a" }, body: { doctor_id: "doc_meera", profile_id: profileId, slot_start: free[0]?.start } });
    const second = await call("POST", "/bookings", { token, headers: { "idempotency-key": "b" }, body: { doctor_id: "doc_meera", profile_id: profileId, slot_start: free[1]?.start } });
    const booking = bookingSchema.parse(second.json);
    const issued = tokenSchema.parse((await call("POST", "/tokens", { token, headers: { "x-fast-demo": "1" }, body: { booking_id: booking.booking_id } })).json);

    const candidates = swapCandidatesSchema.parse((await call("GET", `/tokens/${issued.id}/swap-candidates`, { token })).json);
    const target = candidates.candidates[0];
    const created = swapRequestSchema.parse(
      (await call("POST", `/tokens/${issued.id}/swap-requests`, { token, body: { to_token_id: target?.id, message: "hello" } })).json,
    );
    expect(created.state).toBe("pending");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 30_000);
    const resolved = swapRequestSchema.parse((await call("GET", `/tokens/${issued.id}/swap-requests/latest`, { token })).json);
    expect(resolved.state).toBe("accepted");
    expect(resolved.to_token.label).toBe(target?.label);
    const moved = tokenSchema.parse((await call("GET", `/tokens/${issued.id}`, { token })).json);
    expect(moved.label).toBe(target?.label);
    vi.useRealTimers();
  });
});

describe("reports: upload, review, explain", () => {
  const handle = newHandle();
  const { call, login } = makeClient(handle);
  let token = "";
  let profileId = "";
  let reportId = "";

  beforeAll(async () => {
    const auth = await login("9876500001");
    token = auth.access_token;
    profileId = auth.user.profiles[0]?.id ?? "";
  });
  afterAll(() => vi.useRealTimers());

  it("lists the seeded past reports with flag counts", async () => {
    const list = (await call("GET", "/reports", { token })).json as { reports: unknown[] };
    const reports = list.reports.map((entry) => reportListItemSchema.parse(entry));
    expect(reports.map((report) => report.report_type).sort()).toEqual(["Diabetes check-up", "Lipid profile"]);
    expect(reports.find((report) => report.report_type === "Lipid profile")?.flag_count).toBe(2);
  });

  it("step 4: upload, process and poll through to ready_for_review", async () => {
    const uploaded = await call("POST", "/reports", { token, body: { profile_id: profileId, file_name: "report.jpg", mime_type: "image/jpeg" } });
    reportId = uploadReportResponseSchema.parse(uploaded.json).report_id;

    const started = await call("POST", "/ai/reports/process", { token, body: { report_id: reportId } });
    expect(started.status).toBe(202);
    const jobId = processReportResponseSchema.parse(started.json).job_id;

    const first = jobResponseSchema.parse((await call("GET", `/ai/jobs/${jobId}`, { token })).json);
    expect(["queued", "processing"]).toContain(first.status);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2000);
    const done = jobResponseSchema.parse((await call("GET", `/ai/jobs/${jobId}`, { token })).json);
    expect(done).toMatchObject({ status: "ready_for_review", report_id: reportId });
    vi.useRealTimers();
  });

  it("shows one deliberately low-confidence value with its bounding box for the review screen", async () => {
    const report = diagnosticReportSchema.parse((await call("GET", `/reports/${reportId}`, { token })).json);
    expect(report.status).toBe("ready_for_review");
    const lowConfidence = report.observations.filter((entry) => entry.confidence < 0.8);
    expect(lowConfidence.map((entry) => entry.code)).toEqual(["FBS"]);
    expect(lowConfidence[0]).toMatchObject({ value: 152, unit: "mg/dL" });
    expect(lowConfidence[0]?.bbox).toHaveLength(4);
    const image = await handle.app.request(`/api/reports/${reportId}/image`);
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/png");
  });

  it("refuses to explain before the values are confirmed", async () => {
    const response = await call("GET", `/ai/reports/${reportId}/explain`, { token });
    expect(response.status).toBe(409);
    expect((response.json as { error: { code: string } }).error.code).toBe("review_required");
  });

  it("step 4b: after correcting 152 to 132, Explain shows ranges, trend, duplicates and a parchi", async () => {
    const confirmed = diagnosticReportSchema.parse(
      (await call("POST", `/reports/${reportId}/confirm`, { token, body: { observations: [{ code: "FBS", value: 132 }] } })).json,
    );
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.observations.find((entry) => entry.code === "FBS")).toMatchObject({ value: 132, interpretation: "high", confidence: 1 });

    const explained = explainResponseSchema.parse((await call("GET", `/ai/reports/${reportId}/explain?language=mr`, { token })).json);
    expect(explained.language).toBe("mr");
    expect(explained.summary).toMatch(/[ऀ-ॿ]/);
    expect(explained.doctor_questions.length).toBeGreaterThanOrEqual(3);
    expect(explained.doctor_questions.length).toBeLessThanOrEqual(5);

    const hba1c = explained.items.find((item) => item.code === "HBA1C");
    expect(hba1c?.direction).toBe("high");
    expect(hba1c?.history?.map((point) => point.value)).toEqual([7.9, 7.1]);

    expect(explained.items.find((item) => item.code === "TG")?.direction).toBe("normal");
    expect(explained.duplicates.map((duplicate) => [duplicate.code, duplicate.days_ago]).sort()).toEqual([
      ["TC", 20],
      ["TG", 20],
    ]);
    expect(explained.disclaimer).toBeTruthy();
  });

  it("explains in English by default for an English request", async () => {
    const explained = explainResponseSchema.parse((await call("GET", `/ai/reports/${reportId}/explain?language=en`, { token })).json);
    expect(explained.summary).toMatch(/HbA1c/);
    expect(explained.items.every((item) => !/you have/i.test(item.meaning))).toBe(true);
  });

  it("cycles the next uploads through the CBC and vitamin D samples", async () => {
    const created: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const response = await call("POST", "/reports", { token, body: { profile_id: profileId, file_name: "r.pdf", mime_type: "application/pdf" } });
      created.push(uploadReportResponseSchema.parse(response.json).report_id);
    }
    const types: string[] = [];
    for (const id of created) {
      const started = await call("POST", "/ai/reports/process", { token, body: { report_id: id } });
      expect(started.status).toBe(202);
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2000);
    for (const id of created) {
      const list = (await call("GET", "/reports", { token })).json as { reports: Array<{ id: string; report_type: string }> };
      types.push(list.reports.find((entry) => entry.id === id)?.report_type ?? "");
      await call("GET", `/ai/jobs/${id.replace("rep_new_", "job_")}`, { token });
    }
    expect(types).toEqual(["Complete blood count", "Vitamin D"]);
    vi.useRealTimers();
  });

  it("does not let someone upload into another family's profile", async () => {
    const response = await call("POST", "/reports", { token, body: { profile_id: "prof_02_self", file_name: "x.jpg", mime_type: "image/jpeg" } });
    expect(response.status).toBe(403);
  });
});

describe("assistant stream over HTTP", () => {
  const handle = newHandle();
  const { raw, login } = makeClient(handle);

  async function chat(message: string, language?: string) {
    const auth = await login("9876500001");
    const response = await raw("POST", "/ai/assistant/chat", { token: auth.access_token, body: { message, language } });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const messages = [];
    for await (const item of readSseStream(response.body as ReadableStream<Uint8Array>)) messages.push(item);
    return messages;
  }

  it("step 5: explains a report word in the patient's language, then done", async () => {
    const messages = await chat("HbA1c म्हणजे काय?", "mr");
    const types = messages.map((entry) => entry.event);
    expect(types[0]).toBe("token");
    expect(types.at(-1)).toBe("done");
    expect(types).not.toContain("citations");
    const text = messages.filter((entry) => entry.event === "token").map((entry) => (JSON.parse(entry.data) as { text: string }).text).join("");
    expect(text).toMatch(/[ऀ-ॿ]/);
    expect(text).toContain("तीन महिन्यांची");
    expect(assistantDoneEventSchema.parse(JSON.parse(messages.at(-1)?.data ?? "{}")).disclaimer).toBeTruthy();
  });

  it("step 5b: anything that is not about the report gets the one fixed message", async () => {
    for (const question of ["How many metformin tablets should I take?", "Who won the cricket match?"]) {
      const messages = await chat(question, "en");
      expect(messages.map((entry) => entry.event)).toEqual(["refusal", "done"]);
      expect(assistantRefusalEventSchema.parse(JSON.parse(messages[0]?.data ?? "{}")).message).toBe("I can only answer doubts related to the report.");
    }
  });

  it("uses the patient's own confirmed report values in the answer", async () => {
    const auth = await login("9876500001");
    const reportId = ((await raw("GET", "/reports", { token: auth.access_token }).then((response) => response.json())) as { reports: Array<{ id: string; status: string }> }).reports.find((entry) => entry.status === "confirmed")?.id;
    expect(reportId).toBeTruthy();
    const messages = await chat("What does HbA1c mean?", "en");
    const text = messages.filter((entry) => entry.event === "token").map((entry) => (JSON.parse(entry.data) as { text: string }).text).join("");
    expect(text).toContain("In your report, HbA1c is 7.9");
  });
});

describe("triage follow-up flow over HTTP", () => {
  const handle = newHandle();
  const { call, login } = makeClient(handle);

  it("asks one question for the headache phrase, then settles or escalates", async () => {
    const auth = await login("9876500001");
    const token = auth.access_token;
    const first = triageResponseSchema.parse(
      (await call("POST", "/ai/triage", { token, body: { text: "मुझे दो दिन से सिर में बहुत दर्द है", age: 58, sex: "female" } })).json,
    );
    expect(first.follow_up_questions).toHaveLength(1);
    const question = first.follow_up_questions[0];
    const asked = typeof question === "string" ? question : (question?.question ?? "");
    const options = typeof question === "string" ? [] : (question?.options ?? []);

    const settled = triageResponseSchema.parse(
      (await call("POST", "/ai/triage/answer", { token, body: { session_id: first.session_id, answers: [{ question: asked, answer: options[1] ?? "no" }] } })).json,
    );
    expect(settled).toMatchObject({ specialty: "General Physician", urgency: "soon" });
    expect(settled.follow_up_questions).toEqual([]);

    const escalated = triageResponseSchema.parse(
      (await call("POST", "/ai/triage/answer", { token, body: { session_id: first.session_id, answers: [{ question: asked, answer: options[0] ?? "yes" }] } })).json,
    );
    expect(escalated.urgency).toBe("emergency");
    expect(escalated.red_flags.length).toBeGreaterThan(0);

    const missing = await call("POST", "/ai/triage/answer", { token, body: { session_id: "sess_nope", answers: [{ question: "q", answer: "a" }] } });
    expect(missing.status).toBe(404);
  });

  it("returns the emergency screen data for the red-flag demo phrases", async () => {
    const auth = await login("9876500001");
    for (const text of ["chest pain and sweating", "बच्चे को तेज बुखार है, 2 महीने का है"]) {
      const result = triageResponseSchema.parse((await call("POST", "/ai/triage", { token: auth.access_token, body: { text, age: 40, sex: "male" } })).json);
      expect(result.urgency).toBe("emergency");
      expect(result.red_flags.length).toBeGreaterThan(0);
    }
  });

  it("rejects an invalid triage body with the shared error shape", async () => {
    const auth = await login("9876500001");
    const response = await call("POST", "/ai/triage", { token: auth.access_token, body: { text: "" } });
    expect(response.status).toBe(400);
    expect((response.json as { error: { code: string; retry: boolean } }).error).toMatchObject({ code: "invalid_request", retry: false });
  });
});

describe("emergency, hospital dashboard and simulator", () => {
  const handle = newHandle();
  const { call, login } = makeClient(handle);

  it("sends a pre-alert to the nearest emergency department and staff see it", async () => {
    const patient = await login("9876500001");
    const sent = await call("POST", "/emergency", {
      token: patient.access_token,
      body: { ...sunita, profile_id: patient.user.profiles[1]?.id, summary: "Chest pain with sweating, age 82" },
    });
    expect(sent.status).toBe(201);
    const result = emergencyResponseSchema.parse(sent.json);
    expect(result.hospital.has_emergency).toBe(true);
    expect(result.hospital.id).toBe("hosp_karve");

    const staff = await login("9000000001");
    const alerts = preAlertsSchema.parse((await call("GET", "/dashboard/pre-alerts", { token: staff.access_token })).json);
    expect(alerts.alerts[0]).toMatchObject({ patient_label: "Shanta Joshi", age: 82 });
  });

  it("shows overview, live queues, booking modes and analytics to staff", async () => {
    const staff = await login("9000000001");
    const token = staff.access_token;
    const overview = dashboardOverviewSchema.parse((await call("GET", "/dashboard/overview", { token })).json);
    expect(overview.total_waiting).toBeGreaterThan(0);
    expect(overview.busiest_doctor).not.toBeNull();

    const doctors = dashboardDoctorsSchema.parse((await call("GET", "/dashboard/doctors", { token })).json).doctors;
    expect(doctors.map((row) => row.doctor_id)).toEqual(expect.arrayContaining(["doc_meera", "doc_arjun", "doc_fatima"]));
    expect(doctors.find((row) => row.doctor_id === "doc_fatima")?.waiting).toBe(11);

    const modes = bookingModesSchema.parse((await call("GET", "/dashboard/booking-modes", { token })).json);
    expect(modes.modes.length).toBe(doctors.length);

    const analytics = analyticsSchema.parse((await call("GET", "/dashboard/analytics", { token })).json);
    expect(analytics.synthetic).toBe(true);
    expect(analytics.patients_per_hour.length).toBeGreaterThanOrEqual(8);

    const accuracy = accuracySchema.parse((await call("GET", "/dashboard/analytics/accuracy", { token })).json);
    expect(accuracy.model_mae_minutes).toBeLessThan(5);
    expect(accuracy.simple_mae_minutes).toBeGreaterThan(8);
    expect(accuracy.daily).toHaveLength(14);
  });

  it("lets staff call the next patient and complete a consult", async () => {
    const staff = await login("9000000001");
    const token = staff.access_token;
    const before = dashboardDoctorsSchema.parse((await call("GET", "/dashboard/doctors", { token })).json).doctors.find((row) => row.doctor_id === "doc_arjun");
    expect(before?.now_serving).toBe("C-09");

    const early = await call("POST", `/tokens/${before?.next_token_id}/call`, { token });
    expect(early.status).toBe(409);
    expect((early.json as { error: { code: string } }).error.code).toBe("already_serving");

    expect((await call("POST", `/tokens/${before?.serving_token_id}/complete`, { token })).status).toBe(200);
    expect((await call("POST", `/tokens/${before?.serving_token_id}/complete`, { token })).status).toBe(409);

    expect((await call("POST", `/tokens/${before?.next_token_id}/call`, { token })).status).toBe(200);
    const after = dashboardDoctorsSchema.parse((await call("GET", "/dashboard/doctors", { token })).json).doctors.find((row) => row.doctor_id === "doc_arjun");
    expect(after?.now_serving).toBe("C-10");
    expect(after?.waiting).toBe((before?.waiting ?? 0) - 1);
  });

  it("replays a day: the rush flips one doctor to pessimistic booking and emits events", async () => {
    const replayHandle = newHandle();
    const { simulator, world } = replayHandle;
    const events: string[] = [];
    world.subscribe((event) => events.push(event.type));

    world.engine.reset({ empty: true });
    world.clock.setSpeed(0);

    const modeByMinute = new Map<number, string>();
    for (let minute = 9 * 60; minute <= 17 * 60; minute += 1) {
      simulator.stepReplay(minute, 1);
      modeByMinute.set(minute, world.engine.doctorQueue("doc_fatima")?.bookingMode ?? "");
    }

    const flipped = [...modeByMinute].filter(([, mode]) => mode === "pessimistic");
    expect(flipped.length).toBeGreaterThan(0);
    const firstFlip = flipped[0]?.[0] ?? 0;
    expect(firstFlip).toBeGreaterThanOrEqual(10 * 60);
    expect(firstFlip).toBeLessThanOrEqual(12 * 60);
    expect(modeByMinute.get(9 * 60)).toBe("optimistic");

    expect(events).toContain("doctor_delay");
    expect(events).toContain("token_issued");
    expect(events).toContain("token_called");
    expect(events).toContain("token_completed");
  });

  it("controls the simulator over HTTP and returns to the starting state on reset", async () => {
    const staff = await login("9000000001");
    const token = staff.access_token;
    const started = (await call("POST", "/mock/simulator/replay", { token, headers: { "x-fast-demo": "1" } })).json as { running: boolean; mode: string };
    expect(started).toMatchObject({ running: true, mode: "replay" });
    const stopped = (await call("POST", "/mock/simulator/stop", { token })).json as { running: boolean; mode: string };
    expect(stopped).toMatchObject({ running: false, mode: "live" });
    const reset = await call("POST", "/mock/simulator/reset", { token });
    expect(reset.status).toBe(200);
    const doctors = dashboardDoctorsSchema.parse((await call("GET", "/dashboard/doctors", { token })).json).doctors;
    expect(doctors.find((row) => row.doctor_id === "doc_meera")?.now_serving).toBe("A-18");
    expect((await call("POST", "/mock/simulator/replay", { token: (await login("9876500001")).access_token })).status).toBe(403);
    replayCleanup(handle);
  });
});

function replayCleanup(handle: AppHandle): void {
  handle.simulator.dispose();
}

describe("live mode proxy", () => {
  const liveEnv = loadEnv({ DATA_MODE: "live", BACKEND_URL: "http://backend.test:8000", AI_URL: "http://ai.test:8001" });

  it("forwards backend paths with the JWT, idempotency key and body", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ booking_id: "bk_live" }), { status: 201, headers: { "content-type": "application/json" } }));
    const { app } = createAppHandle(liveEnv, { latency: noLatency });
    const response = await app.request("/api/bookings?x=1", {
      method: "POST",
      headers: { authorization: "Bearer real.jwt", "idempotency-key": "k1", "content-type": "application/json", cookie: "secret=1" },
      body: JSON.stringify({ doctor_id: "d1" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ booking_id: "bk_live" });
    const [url, init] = upstream.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://backend.test:8000/bookings?x=1");
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("authorization")).toBe("Bearer real.jwt");
    expect(headers.get("idempotency-key")).toBe("k1");
    expect(headers.get("cookie")).toBeNull();
    upstream.mockRestore();
  });

  it("sends /api/ai/* to the AI service and passes SSE through untouched", async () => {
    const stream = new Response("event: token\ndata: {\"text\":\"hi\"}\n\nevent: done\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(stream);
    const { app } = createAppHandle(liveEnv, { latency: noLatency });
    const response = await app.request("/api/ai/assistant/chat", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(String(upstream.mock.calls[0]?.[0])).toBe("http://ai.test:8001/ai/assistant/chat");
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(await response.text()).toContain("event: token");
    upstream.mockRestore();
  });

  it("answers meta locally and never forwards it", async () => {
    const upstream = vi.spyOn(globalThis, "fetch");
    const { app } = createAppHandle(liveEnv, { latency: noLatency });
    const response = await app.request("/api/meta");
    expect(await response.json()).toEqual({ data_mode: "live", sarvam_enabled: false, sarvam_mode: "off", assistant_mode: "local" });
    expect(upstream).not.toHaveBeenCalled();
    upstream.mockRestore();
  });

  it("returns the shared error shape when the upstream is down", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"));
    const { app } = createAppHandle(liveEnv, { latency: noLatency });
    const response = await app.request("/api/queue/doc_1");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: "upstream_unreachable", message: "The Healix service is not reachable right now", retry: true } });
    upstream.mockRestore();
  });

  it("has no mock-only routes in live mode", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "not_found", message: "x", retry: false } }), { status: 404 }));
    const { app } = createAppHandle(liveEnv, { latency: noLatency });
    const response = await app.request("/api/mock/simulator");
    expect(String(upstream.mock.calls[0]?.[0])).toBe("http://backend.test:8000/mock/simulator");
    expect(response.status).toBe(404);
    upstream.mockRestore();
  });
});

describe("family profiles and the nearest emergency department", () => {
  it("adds a profile for the signed-in patient, and a reset puts the seed back", async () => {
    const handle = newHandle();
    const { call, login } = makeClient(handle);
    const auth = await login("9876500001");
    const token = auth.access_token;

    const created = await call("POST", "/profiles", {
      token,
      body: { name: "Baba Patil", relation: "father", age: 85, sex: "male", conditions: [], language: "mr", elder_mode: true },
    });
    expect(created.status).toBe(201);
    expect((await call("GET", "/me", { token })).json).toMatchObject({ profiles: expect.arrayContaining([expect.objectContaining({ name: "Baba Patil" })]) });
    expect(((await call("GET", "/profiles", { token })).json as { profiles: unknown[] }).profiles).toHaveLength(3);

    expect((await call("POST", "/profiles", { token, body: { name: "" } })).status).toBe(400);

    const fresh = makeClient(newHandle());
    expect((await fresh.login("9876500001")).user.profiles).toHaveLength(2);

    const staff = await login("9000000001");
    await call("POST", "/mock/simulator/reset", { token: staff.access_token });
    expect(((await call("GET", "/profiles", { token })).json as { profiles: unknown[] }).profiles).toHaveLength(2);
  });

  it("finds the nearest emergency department with distance and travel time", async () => {
    const { call, login } = makeClient(newHandle());
    const { access_token: token } = await login("9876500001");
    const nearest = nearestEmergencySchema.parse((await call("GET", `/emergency/nearest?lat=${sunita.lat}&lng=${sunita.lng}`, { token })).json);
    expect(nearest.hospital.id).toBe("hosp_karve");
    expect(nearest.hospital.has_emergency).toBe(true);
    expect(nearest.distance_km).toBe(2.1);
    expect(nearest.eta_minutes).toBeGreaterThanOrEqual(5);

    const farEast = nearestEmergencySchema.parse((await call("GET", "/emergency/nearest?lat=18.5679&lng=73.9143", { token })).json);
    expect(farEast.hospital.has_emergency).toBe(true);
    expect(farEast.hospital.id).not.toBe("hosp_viman");

    expect((await call("GET", "/emergency/nearest?lat=x&lng=y", { token })).status).toBe(400);
    expect((await call("GET", "/emergency/nearest?lat=18.5&lng=73.8")).status).toBe(200);
  });
});

describe("assistant with Groq connected", () => {
  const prompts: string[] = [];
  const handle = createAppHandle(loadEnv({ GROQ_API_KEY: "test-key", GROQ_MODEL: "test-model" }), {
    world: new MockWorld(),
    latency: noLatency,
    groqTransport: async (_url, init) => {
      prompts.push(String(init.body));
      const piece = JSON.stringify({ choices: [{ delta: { content: "Your HbA1c is above the printed range [1]. Please ask your doctor." } }] });
      return new Response(`data: ${piece}\n\ndata: [DONE]\n\n`, { status: 200 });
    },
  });
  const { call, raw, login } = makeClient(handle);

  it("reports the assistant mode and answers from the stored report chunks", async () => {
    expect(((await call("GET", "/meta")).json as { assistant_mode: string }).assistant_mode).toBe("groq");
    const auth = await login("9876500001");
    const response = await raw("POST", "/ai/assistant/chat", { token: auth.access_token, body: { message: "Is my HbA1c high in the report?", language: "en" } });
    const messages = [];
    for await (const item of readSseStream(response.body as ReadableStream<Uint8Array>)) messages.push(item);
    const citations = messages.find((entry) => entry.event === "citations");
    expect(citations).toBeDefined();
    expect(assistantCitationsEventSchema.parse(JSON.parse(citations?.data ?? "[]"))[0]?.url).toMatch(/^\/app\/reports\/rep_/);
    expect(prompts.at(-1)).toContain("HbA1c");
    expect(prompts.at(-1)).not.toContain("test-key");
  });

  it("does not call Groq for a medicine question", async () => {
    const before = prompts.length;
    const auth = await login("9876500001");
    const response = await raw("POST", "/ai/assistant/chat", { token: auth.access_token, body: { message: "How many metformin tablets should I take?" } });
    const messages = [];
    for await (const item of readSseStream(response.body as ReadableStream<Uint8Array>)) messages.push(item);
    expect(messages.map((entry) => entry.event)).toEqual(["refusal", "done"]);
    expect(prompts.length).toBe(before);
  });
});
