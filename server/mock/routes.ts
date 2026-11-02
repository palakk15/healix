import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { z } from "zod";
import {
  assistantChatRequestSchema,
  confirmValuesRequestSchema,
  processReportRequestSchema,
  triageAnswerRequestSchema,
  triageRequestSchema,
  uploadReportRequestSchema,
} from "@core/api/schemas/ai";
import {
  authRequestSchema,
  bookingRequestSchema,
  consentRequestSchema,
  emergencyRequestSchema,
  issueTokenRequestSchema,
  matchRequestSchema,
  profileSchema,
  profileUpdateSchema,
  swapCreateRequestSchema,
  type User,
} from "@core/api/schemas/backend";
import { communityTopicSchema, createCommentRequestSchema, createPostRequestSchema, voteRequestSchema } from "@core/api/schemas/community";
import { isLanguageCode, type LanguageCode } from "@core/i18n/languages";
import { kindOf, normaliseMime } from "../live/documents";
import type { GroqConfig, GroqTransport } from "../rag/groq";
import { ragAnswer } from "../rag/assistant";
import { VectorStore } from "../rag/store";
import { dashboardAccuracyFor, dashboardAnalyticsFor, dashboardBookingModes, dashboardDoctors, dashboardOverview } from "./dashboard";
import { MockError } from "./errors";
import { bestTimes, matchDoctors } from "./match";
import { answerTriage, runTriage } from "./triage";
import type { Simulator } from "./simulator";
import type { MockWorld } from "./world";

export interface MockLatency {
  enabled: boolean;
  triageMs: [number, number];
  matchMs: number;
  reportJobMs: [number, number];
  assistantWordMs: number;
}

export const defaultLatency: MockLatency = {
  enabled: true,
  triageMs: [1200, 2000],
  matchMs: 400,
  reportJobMs: [4000, 6000],
  assistantWordMs: 35,
};

export const noLatency: MockLatency = { enabled: false, triageMs: [0, 0], matchMs: 0, reportJobMs: [300, 300], assistantWordMs: 0 };

const sleep = (ms: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, ms));
const dataDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "data");
const maxUploadBytes = 50 * 1024 * 1024;

export interface MockApiOptions {
  otp?: string;
  world: MockWorld;
  simulator: Simulator;
  latency: MockLatency;
  onReset?: () => void;
  rag?: RagSetup;
}

export interface RagSetup {
  store: VectorStore;
  groq?: GroqConfig;
  transport?: GroqTransport;
}

export function createMockApi({ world, simulator, latency, onReset, rag, otp = "123456" }: MockApiOptions): Hono {
  const api = new Hono();
  const knowledge: RagSetup = rag ?? { store: new VectorStore() };
  let requestCounter = 0;

  const isFast = (context: Context) => context.req.header("x-fast-demo") === "1";
  const requestId = (prefix: string) => `${prefix}_${String(++requestCounter).padStart(5, "0")}`;
  const wait = async (context: Context, ms: number) => {
    if (latency.enabled && !isFast(context) && ms > 0) await sleep(ms);
  };
  const between = ([low, high]: [number, number]) => Math.round(low + Math.random() * (high - low));

  const requireUser = (context: Context): User => {
    const user = world.userFromAuthorization(context.req.header("authorization"));
    if (!user) throw new MockError(401, "unauthorized", "Please sign in again", false);
    return user;
  };
  const requireStaff = (context: Context): User => {
    const user = requireUser(context);
    if (user.role !== "staff") throw new MockError(403, "staff_only", "This area is for hospital staff", false);
    return user;
  };
  const body = async <Schema extends z.ZodType>(context: Context, schema: Schema): Promise<z.infer<Schema>> => {
    const raw: unknown = await context.req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new MockError(400, "invalid_request", "The request was not understood", false);
    return parsed.data;
  };
  const languageOf = (value: string | undefined | null, fallback: LanguageCode): LanguageCode =>
    isLanguageCode(value) ? value : fallback;

  api.onError((error, context) => {
    if (error instanceof MockError) return context.json(error.toBody(), error.status as 400);
    return context.json({ error: { code: "internal_error", message: "Something went wrong", retry: true } }, 500);
  });

  api.post("/auth/login", async (context) => {
    const request = await body(context, authRequestSchema);
    if (request.otp !== otp) throw new MockError(401, "invalid_otp", "That code is not correct", false);
    const user = world.findUserByPhone(request.phone);
    if (!user) throw new MockError(404, "user_not_found", "No account for this number yet", false);
    return context.json({ access_token: world.accessTokenFor(user), user });
  });

  api.post("/auth/register", async (context) => {
    const request = await body(context, authRequestSchema);
    if (!world.demo && request.otp !== otp) throw new MockError(401, "invalid_otp", "That code is not correct", false);
    if (world.findUserByPhone(request.phone)) throw new MockError(409, "phone_exists", "This number already has an account", false);
    const user = world.registerPatient(request.phone, request.name);
    return context.json({ access_token: world.accessTokenFor(user), user }, 201);
  });

  api.get("/me", (context) => context.json(requireUser(context)));

  api.get("/profiles", (context) => context.json({ profiles: requireUser(context).profiles }));

  api.post("/profiles", async (context) => {
    const user = requireUser(context);
    const request = await body(context, profileSchema.omit({ id: true }));
    return context.json(world.addProfile(user, request), 201);
  });

  api.put("/profiles/:id", async (context) => {
    const user = requireUser(context);
    const request = await body(context, profileUpdateSchema);
    return context.json(world.updateProfile(user, context.req.param("id"), request));
  });

  api.get("/community/topics", (context) => {
    requireUser(context);
    return context.json({ topics: world.community.topics() });
  });

  api.get("/community/posts", (context) => {
    const user = requireUser(context);
    const topic = communityTopicSchema.safeParse(context.req.query("topic"));
    const sort = context.req.query("sort") === "top" ? "top" : "new";
    return context.json({ posts: world.community.list(user.id, { ...(topic.success ? { topic: topic.data } : {}), sort, query: context.req.query("q") }) });
  });

  api.post("/community/posts", async (context) => {
    const user = requireUser(context);
    if (user.role !== "patient") throw new MockError(403, "patients_only", "Only patients can post", false);
    const request = await body(context, createPostRequestSchema);
    return context.json(world.community.create(user, request), 201);
  });

  api.get("/community/posts/:id", (context) => {
    const user = requireUser(context);
    const post = world.community.get(user.id, context.req.param("id"));
    if (!post) throw new MockError(404, "post_not_found", "Post not found");
    return context.json(post);
  });

  api.post("/community/posts/:id/comments", async (context) => {
    const user = requireUser(context);
    if (user.role !== "patient") throw new MockError(403, "patients_only", "Only patients can reply", false);
    const request = await body(context, createCommentRequestSchema);
    return context.json(world.community.comment(user, context.req.param("id"), request.body), 201);
  });

  api.post("/community/posts/:id/vote", async (context) => {
    const user = requireUser(context);
    const request = await body(context, voteRequestSchema);
    return context.json(world.community.vote(user, context.req.param("id"), request.value));
  });

  api.post("/community/posts/:id/report", (context) => {
    world.community.report(requireUser(context), context.req.param("id"));
    return context.json({ ok: true });
  });

  api.delete("/community/posts/:id", (context) => {
    world.community.remove(requireUser(context), context.req.param("id"));
    return context.json({ ok: true });
  });

  api.get("/consent", (context) => context.json({ consents: world.listConsents(requireUser(context).id) }));

  api.post("/consent", async (context) => {
    const user = requireUser(context);
    const request = await body(context, consentRequestSchema);
    return context.json(world.setConsent(user.id, request.purpose, request.granted), 201);
  });

  api.delete("/consent/:id", (context) => {
    const user = requireUser(context);
    if (!world.deleteConsent(user.id, context.req.param("id"))) throw new MockError(404, "consent_not_found", "Consent not found");
    return context.json({ ok: true });
  });

  api.post("/match", async (context) => {
    requireUser(context);
    const request = await body(context, matchRequestSchema);
    await wait(context, latency.matchMs);
    return context.json({ items: matchDoctors(world, request), server_time: world.nowIso() });
  });

  api.get("/doctors/:id", (context) => context.json(world.doctorView(world.requireDoctor(context.req.param("id")))));

  api.get("/doctors/:id/best-times", (context) => {
    requireUser(context);
    return context.json(bestTimes(world, context.req.param("id")));
  });

  api.get("/doctors/:id/slots", (context) => {
    requireUser(context);
    return context.json(world.slotsFor(context.req.param("id")));
  });

  api.post("/bookings", async (context) => {
    const user = requireUser(context);
    const key = context.req.header("idempotency-key");
    if (!key) throw new MockError(400, "idempotency_key_required", "An Idempotency-Key header is required", false);
    const request = await body(context, bookingRequestSchema);
    const outcome = world.createBooking(user, request, key);
    return context.json(outcome.body as object, outcome.status as 201);
  });

  api.post("/tokens", async (context) => {
    const user = requireUser(context);
    const request = await body(context, issueTokenRequestSchema);
    return context.json(world.issueTokenForBooking(user, request.booking_id, isFast(context)), 201);
  });

  api.get("/tokens/mine", (context) => context.json({ tokens: world.tokensFor(requireUser(context)) }));

  api.get("/tokens/:id", (context) => {
    const user = requireUser(context);
    return context.json(world.tokenView(world.tokenOwnedBy(user, context.req.param("id"))));
  });

  const assertStaffHospital = (staff: User, tokenId: string) => {
    if (world.demo) return;
    const token = world.engine.token(tokenId);
    const doctor = token ? world.doctors.get(token.doctorId) : undefined;
    if (token && doctor && doctor.hospital_id !== staff.hospital_id) throw new MockError(403, "other_hospital", "This token belongs to another hospital", false);
  };

  api.post("/tokens/:id/call", (context) => {
    assertStaffHospital(requireStaff(context), context.req.param("id"));
    const outcome = world.engine.call(context.req.param("id"));
    if (outcome === "not_found") throw new MockError(404, "token_not_found", "Token not found");
    if (outcome === "not_waiting") throw new MockError(409, "token_not_waiting", "This token is not waiting");
    if (outcome === "already_serving") throw new MockError(409, "already_serving", "Complete the current patient first");
    const token = world.engine.token(context.req.param("id"));
    return context.json(token ? world.tokenView(token) : { ok: true });
  });

  api.post("/tokens/:id/complete", (context) => {
    assertStaffHospital(requireStaff(context), context.req.param("id"));
    const outcome = world.engine.complete(context.req.param("id"));
    if (outcome === "not_found") throw new MockError(404, "token_not_found", "Token not found");
    if (outcome === "not_called") throw new MockError(409, "token_not_called", "This token was not called yet");
    const token = world.engine.token(context.req.param("id"));
    return context.json(token ? world.tokenView(token) : { ok: true });
  });

  api.get("/queue/:doctorId", (context) => {
    if (!world.demo) requireUser(context);
    return context.json(world.queueView(context.req.param("doctorId")));
  });

  api.get("/events/stream", (context) => {
    const viewer = world.demo ? undefined : requireUser(context);
    return streamSSE(context, async (stream) => {
      const unsubscribe = world.subscribe((event) => {
        if (viewer && viewer.role !== "staff" && event.type === "emergency_prealert") return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "ready", data: JSON.stringify({ at: world.nowIso() }) });
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(15_000);
        if (stream.aborted || stream.closed) break;
        await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: world.nowIso() }) });
      }
      unsubscribe();
    });
  });

  api.get("/tokens/:id/swap-candidates", (context) =>
    context.json(world.swapCandidates(requireUser(context), context.req.param("id"))),
  );

  api.post("/tokens/:id/swap-requests", async (context) => {
    const user = requireUser(context);
    const request = await body(context, swapCreateRequestSchema);
    return context.json(world.createSwap(user, context.req.param("id"), request.to_token_id, request.message, isFast(context)), 201);
  });

  api.get("/tokens/:id/swap-requests/latest", (context) => {
    const latest = world.outgoingSwap(requireUser(context), context.req.param("id"));
    if (!latest) throw new MockError(404, "swap_not_found", "No swap requests yet");
    return context.json(latest);
  });

  api.get("/swap-requests/incoming", (context) => context.json({ requests: world.incomingSwaps(requireUser(context)) }));

  api.post("/swap-requests/:id/accept", (context) => context.json(world.respondToSwap(requireUser(context), context.req.param("id"), true)));

  api.post("/swap-requests/:id/decline", (context) => context.json(world.respondToSwap(requireUser(context), context.req.param("id"), false)));

  api.delete("/swap-requests/:id", (context) => context.json(world.cancelSwap(requireUser(context), context.req.param("id"))));

  const hospitalOf = (user: User) => user.hospital_id ?? "hosp_karve";

  const staffDoctor = (staff: User, doctorId: string) => {
    const doctor = world.doctors.get(doctorId);
    if (!doctor) throw new MockError(404, "doctor_not_found", "Doctor not found");
    if (doctor.hospital_id !== hospitalOf(staff)) throw new MockError(403, "other_hospital", "This doctor belongs to another hospital", false);
    return doctor;
  };

  api.get("/dashboard/doctors/:id/queue", (context) => {
    staffDoctor(requireStaff(context), context.req.param("id"));
    return context.json(world.staffQueueView(context.req.param("id")));
  });

  api.post("/dashboard/doctors/:id/walk-in", (context) => {
    staffDoctor(requireStaff(context), context.req.param("id"));
    world.engine.issueWalkIns(context.req.param("id"), 1);
    return context.json(world.staffQueueView(context.req.param("id")), 201);
  });

  api.post("/dashboard/doctors/:id/break", async (context) => {
    staffDoctor(requireStaff(context), context.req.param("id"));
    const raw = (await context.req.json().catch(() => ({}))) as { on_break?: unknown };
    world.engine.setBreak(context.req.param("id"), raw.on_break === true);
    return context.json(world.staffQueueView(context.req.param("id")));
  });

  api.post("/dashboard/doctors/:id/delay", async (context) => {
    staffDoctor(requireStaff(context), context.req.param("id"));
    const raw = (await context.req.json().catch(() => ({}))) as { delay_minutes?: unknown };
    const minutes = typeof raw.delay_minutes === "number" ? Math.round(raw.delay_minutes) : NaN;
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 120) throw new MockError(400, "invalid_request", "delay_minutes must be between 0 and 120", false);
    world.engine.setDelay(context.req.param("id"), minutes);
    return context.json(world.staffQueueView(context.req.param("id")));
  });

  api.post("/tokens/:id/skip", (context) => {
    const staff = requireStaff(context);
    assertStaffHospital(staff, context.req.param("id"));
    const outcome = world.engine.skip(context.req.param("id"));
    if (outcome === "not_found") throw new MockError(404, "token_not_found", "Token not found");
    if (outcome === "not_active") throw new MockError(409, "token_not_active", "This token is already finished");
    return context.json({ ok: true });
  });

  api.get("/dashboard/overview", (context) => context.json(dashboardOverview(world, hospitalOf(requireStaff(context)))));
  api.get("/dashboard/doctors", (context) => context.json(dashboardDoctors(world, hospitalOf(requireStaff(context)))));
  api.get("/dashboard/analytics/accuracy", (context) => context.json(dashboardAccuracyFor(world, hospitalOf(requireStaff(context)))));
  api.get("/dashboard/analytics", (context) => context.json(dashboardAnalyticsFor(world, hospitalOf(requireStaff(context)))));
  api.get("/dashboard/booking-modes", (context) => context.json(dashboardBookingModes(world, hospitalOf(requireStaff(context)))));
  api.get("/dashboard/pre-alerts", (context) => {
    const hospitalId = hospitalOf(requireStaff(context));
    return context.json({
      alerts: world.alerts
        .filter((alert) => alert.hospitalId === hospitalId)
        .map((alert) => ({
          id: alert.id,
          patient_label: alert.patientLabel,
          age: alert.age,
          summary: alert.summary,
          eta_minutes: alert.etaMinutes,
          received_at: alert.receivedAt,
        })),
    });
  });

  api.get("/emergency/nearest", (context) => {
    const lat = Number(context.req.query("lat"));
    const lng = Number(context.req.query("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new MockError(400, "invalid_request", "lat and lng are required", false);
    return context.json(world.nearestEmergency({ lat, lng }));
  });

  api.post("/emergency", async (context) => {
    const user = requireUser(context);
    const request = await body(context, emergencyRequestSchema);
    return context.json(world.createEmergency(user, request), 201);
  });

  api.get("/reports", (context) => {
    const user = requireUser(context);
    const profileId = context.req.query("profile_id");
    const allowed = new Set(user.profiles.map((profile) => profile.id));
    return context.json({ reports: world.reports.list(profileId).filter((report) => allowed.has(report.profile_id)) });
  });

  const assertReportAccess = (user: User, reportId: string) => {
    if (world.demo) return;
    const report = world.reports.get(reportId);
    if (!report) throw new MockError(404, "report_not_found", "Report not found");
    if (!user.profiles.some((profile) => profile.id === report.profile_id)) throw new MockError(403, "report_not_yours", "This report does not belong to you");
  };

  api.post("/reports", async (context) => {
    const user = requireUser(context);
    if ((context.req.header("content-type") ?? "").includes("multipart/form-data")) {
      const form = await context.req.parseBody();
      const profileId = typeof form.profile_id === "string" ? form.profile_id : "";
      const file = form.file;
      if (!(file instanceof File)) throw new MockError(400, "invalid_request", "Please choose a photo, a PDF, a Word file or a text file", false);
      if (!user.profiles.some((profile) => profile.id === profileId)) throw new MockError(403, "profile_not_yours", "This profile does not belong to you");
      const mime = normaliseMime(file.name, file.type);
      if (!kindOf(mime)) throw new MockError(415, "unsupported_type", "Please choose a photo, a PDF, a Word file or a text file", false);
      if (file.size > maxUploadBytes) throw new MockError(413, "file_too_large", "This file is too large. Please choose one under 50 MB.", false);
      if (world.demo) return context.json({ report_id: world.reports.upload(profileId) }, 201);
      return context.json({ report_id: world.reports.uploadFile(profileId, file.name, mime, Buffer.from(await file.arrayBuffer())) }, 201);
    }
    const request = await body(context, uploadReportRequestSchema);
    if (!user.profiles.some((profile) => profile.id === request.profile_id)) {
      throw new MockError(403, "profile_not_yours", "This profile does not belong to you");
    }
    return context.json({ report_id: world.reports.upload(request.profile_id) }, 201);
  });

  api.get("/reports/:id/image", (context) => {
    if (!world.demo) assertReportAccess(requireUser(context), context.req.param("id"));
    const source = world.reports.imageSource(context.req.param("id"));
    const path = source?.kind === "upload" ? source.path : source ? resolve(dataDirectory, "reports", source.file) : undefined;
    if (!path || !existsSync(path)) throw new MockError(404, "image_not_found", "Report image not found");
    const mime = source?.kind === "upload" ? source.mime : "image/png";
    return new Response(readFileSync(path), { headers: { "content-type": mime, "cache-control": "no-store" } });
  });

  api.get("/reports/:id", (context) => {
    assertReportAccess(requireUser(context), context.req.param("id"));
    const report = world.reports.get(context.req.param("id"));
    if (!report) throw new MockError(404, "report_not_found", "Report not found");
    return context.json(report);
  });

  api.post("/reports/:id/confirm", async (context) => {
    assertReportAccess(requireUser(context), context.req.param("id"));
    const request = await body(context, confirmValuesRequestSchema);
    const outcome = world.reports.confirm(context.req.param("id"), request.observations);
    if (outcome === "not_found") throw new MockError(404, "report_not_found", "Report not found");
    if (outcome === "wrong_state") throw new MockError(409, "not_ready", "This report is still being read", true);
    return context.json(outcome);
  });

  api.post("/ai/triage", async (context) => {
    requireUser(context);
    const request = await body(context, triageRequestSchema);
    await wait(context, between(latency.triageMs));
    const outcome = runTriage(request, requestId("sess"));
    world.triageSessions.set(outcome.session.id, outcome.session);
    return context.json({ ...outcome.response, request_id: requestId("req"), model: "mock-rule-engine", prompt_version: "mock-v1" });
  });

  api.post("/ai/triage/answer", async (context) => {
    requireUser(context);
    const request = await body(context, triageAnswerRequestSchema);
    const session = world.triageSessions.get(request.session_id);
    if (!session) throw new MockError(404, "session_not_found", "This conversation has expired. Please start again.", false);
    await wait(context, between(latency.triageMs) / 2);
    const response = answerTriage(session, request.answers);
    return context.json({ ...response, request_id: requestId("req"), model: "mock-rule-engine", prompt_version: "mock-v1" });
  });

  api.post("/ai/reports/process", async (context) => {
    const user = requireUser(context);
    const request = await body(context, processReportRequestSchema);
    assertReportAccess(user, request.report_id);
    const duration = latency.enabled && !isFast(context) ? between(latency.reportJobMs) : 600;
    const jobId = world.reports.startJob(request.report_id, duration);
    if (!jobId) throw new MockError(404, "report_not_found", "Report not found");
    return context.json({ job_id: jobId }, 202);
  });

  api.get("/ai/jobs/:id", (context) => {
    requireUser(context);
    const status = world.reports.jobStatus(context.req.param("id"));
    if (!status) throw new MockError(404, "job_not_found", "Job not found");
    return context.json({ ...status, job_id: context.req.param("id") });
  });

  api.get("/ai/reports/:id/explain", (context) => {
    const user = requireUser(context);
    const language = languageOf(context.req.query("language"), languageOf(user.language, "en"));
    assertReportAccess(user, context.req.param("id"));
    const outcome = world.reports.explain(context.req.param("id"), language, requestId("req"));
    if (outcome === "not_found") throw new MockError(404, "report_not_found", "Report not found");
    if (outcome === "review_required" || outcome === "wrong_state") {
      throw new MockError(409, "review_required", "Please review and confirm the values first", false);
    }
    return context.json(outcome);
  });

  api.post("/ai/assistant/chat", async (context) => {
    const user = requireUser(context);
    const request = await body(context, assistantChatRequestSchema);
    const fast = isFast(context);
    const ownIds = user.profiles.map((profile) => profile.id);
    const profileIds = request.profile_id && ownIds.includes(request.profile_id) ? [request.profile_id] : ownIds;
    const observations = world.reports.latestObservations(profileIds);
    const documents = world.reports.documentsFor(profileIds);
    return streamSSE(context, async (stream) => {
      const messages = ragAnswer(
        knowledge.store,
        { message: request.message, language: request.language, history: request.history, documents, profileIds, observations },
        {
          requestId: requestId("req"),
          wordDelayMs: latency.enabled && !fast ? latency.assistantWordMs : 0,
          sleep,
          groq: knowledge.groq,
          transport: knowledge.transport,
          onGroqProblem: (reason) => {
            if (process.env.NODE_ENV !== "test") console.warn(`Healix AI: Groq was not used for this answer (${reason}). The built-in reader answered instead.`);
          },
        },
      );
      for await (const message of messages) {
        if (stream.aborted) break;
        await stream.writeSSE({ event: message.event, data: JSON.stringify(message.data) });
      }
    });
  });

  api.use("/mock/*", async (_context, next) => {
    if (!world.demo) throw new MockError(404, "demo_only", "The simulator is only available in demo mode", false);
    await next();
  });
  api.get("/mock/simulator", (context) => context.json(simulator.status()));
  api.post("/mock/simulator/replay", (context) => {
    requireStaff(context);
    return context.json(simulator.startReplay(isFast(context) ? 12 : 120));
  });
  api.post("/mock/simulator/stop", (context) => {
    requireStaff(context);
    return context.json(simulator.stop());
  });
  api.post("/mock/simulator/reset", (context) => {
    requireStaff(context);
    onReset?.();
    return context.json(simulator.reset());
  });
  api.post("/mock/simulator/speed", async (context) => {
    requireStaff(context);
    const raw = (await context.req.json().catch(() => ({}))) as { speed?: number };
    return context.json(simulator.setSpeed(typeof raw.speed === "number" ? raw.speed : 1));
  });

  return api;
}
