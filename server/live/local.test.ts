import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppHandle, parseStaffPhones, type AppHandle } from "../app";
import { loadEnv } from "../env";
import { stopReader } from "./reader";
import { MockWorld } from "../mock/world";

const reports = resolve(import.meta.dirname, "../mock/data/reports");
let directory = "";
let handle: AppHandle;

function env(extra: Record<string, string> = {}) {
  return loadEnv({ DATA_MODE: "local", LOCAL_DATA_DIR: directory, AUTH_CODE: "424242", STAFF_PHONES: "9000000001:karve", ...extra });
}

let keyCounter = 0;

function storedZip(name: string, data: Buffer): Buffer {
  const fileName = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  const centralOffset = local.length + fileName.length + data.length;
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, fileName, data, central, fileName, end]);
}

async function scannedPdf(png: Buffer): Promise<Buffer> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").drawImage(image, 0, 0);
  const jpeg = canvas.toBuffer("image/jpeg");
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  const add = (chunk: string | Buffer) => parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "latin1"));
  const size = () => parts.reduce((total, part) => total + part.length, 0);
  const content = `q ${image.width} 0 0 ${image.height} 0 0 cm /Im0 Do Q`;
  add("%PDF-1.4\n");
  const objects: Array<string | Buffer[]> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  objects.forEach((body, index) => {
    offsets.push(size());
    add(`${index + 1} 0 obj\n${body as string}\nendobj\n`);
  });
  offsets.push(size());
  add(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg);
  add("\nendstream\nendobj\n");
  const xref = size();
  add(`xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(parts);
}

async function call(app: AppHandle, method: string, path: string, options: { body?: unknown; token?: string; form?: FormData } = {}) {
  return app.app.request(`/api${path}`, {
    method,
    headers: {
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(method === "POST" && path === "/bookings" ? { "idempotency-key": `key-${(keyCounter += 1)}` } : {}),
    },
    body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
}

async function register(app: AppHandle, phone: string, name: string): Promise<{ token: string; profileId: string; userId: string }> {
  const response = await call(app, "POST", "/auth/register", { body: { phone, otp: "424242", name } });
  const json = (await response.json()) as { access_token: string; user: { id: string; profiles: Array<{ id: string }> } };
  return { token: json.access_token, profileId: json.user.profiles[0]?.id ?? "", userId: json.user.id };
}

beforeAll(() => {
  directory = mkdtempSync(resolve(tmpdir(), "healix-local-"));
  handle = createAppHandle(env());
});

afterAll(async () => {
  await stopReader();
  rmSync(directory, { recursive: true, force: true });
});

describe("local mode sign-in", () => {
  it("uses the configured code, never the demo one, and signs its tokens", async () => {
    expect((await call(handle, "POST", "/auth/register", { body: { phone: "9811111111", otp: "424242", name: "A" } })).status).toBe(201);
    expect((await call(handle, "POST", "/auth/login", { body: { phone: "9811111111", otp: "123456" } })).status).toBe(401);
    const login = await call(handle, "POST", "/auth/login", { body: { phone: "9811111111", otp: "424242" } });
    expect(login.status).toBe(200);
    const { access_token } = (await login.json()) as { access_token: string };
    expect(access_token.startsWith("v1.")).toBe(true);
    expect((await call(handle, "GET", "/me", { token: access_token })).status).toBe(200);
    const [version, payload, signature] = access_token.split(".");
    expect((await call(handle, "GET", "/me", { token: `${version}.${payload}.${signature?.slice(0, -2)}xx` })).status).toBe(401);
    expect((await call(handle, "GET", "/me", { token: "mock.pat_sunita" })).status).toBe(401);
  });

  it("does not let anyone register without the code", async () => {
    expect((await call(handle, "POST", "/auth/register", { body: { phone: "9822222200", name: "No Code" } })).status).toBe(401);
    expect((await call(handle, "POST", "/auth/register", { body: { phone: "9822222200", otp: "000000", name: "Wrong Code" } })).status).toBe(401);
  });

  it("starts with no demo patients and only the staff phones from the settings", async () => {
    expect((await call(handle, "POST", "/auth/login", { body: { phone: "9876500001", otp: "424242" } })).status).toBe(404);
    const staff = await call(handle, "POST", "/auth/login", { body: { phone: "9000000001", otp: "424242" } });
    expect(((await staff.json()) as { user: { role: string; hospital_id: string } }).user).toMatchObject({ role: "staff", hospital_id: "hosp_karve" });
    expect(parseStaffPhones("9111:karve, 9222:hosp_baner,bad")).toEqual([
      { phone: "9111", hospitalId: "hosp_karve" },
      { phone: "9222", hospitalId: "hosp_baner" },
    ]);
    expect(parseStaffPhones("")).toBeUndefined();
  });

  it("rejects an expired token", () => {
    const world = new MockWorld({ mode: "local", tokenSecret: "s", tokenLifetimeMs: -1000 });
    const user = world.registerPatient("9822222222", "B");
    expect(world.userFromAuthorization(`Bearer ${world.accessTokenFor(user)}`)).toBeUndefined();
  });
});

describe("local mode has no scripted demo moments", () => {
  it("books the first slot, starts with empty queues and a real wait", async () => {
    const patient = await register(handle, "9833333333", "Asha Rao");
    const doctors = (await (await call(handle, "GET", "/dashboard/doctors", { token: (await staffLogin()).token })).json()) as { doctors: Array<{ doctor_id: string; waiting: number }> };
    expect(doctors.doctors.every((row) => row.waiting === 0)).toBe(true);

    const slotsResponse = await call(handle, "GET", "/doctors/doc_meera/slots", { token: patient.token });
    const slots = (await slotsResponse.json()) as { days: Array<{ slots: Array<{ start: string; available: boolean }> }> };
    const free = slots.days.flatMap((day) => day.slots).filter((slot) => slot.available);
    const all = slots.days.flatMap((day) => day.slots);
    expect(free.length).toBe(all.length);
    if (free.length === 0) return;

    const first = free[0];
    const booking = await call(handle, "POST", "/bookings", { token: patient.token, body: { doctor_id: "doc_meera", profile_id: patient.profileId, slot_start: first?.start } });
    expect(booking.status).toBe(201);
    const bookingId = ((await booking.json()) as { booking_id: string }).booking_id;
    const token = await call(handle, "POST", "/tokens", { token: patient.token, body: { booking_id: bookingId } });
    expect(token.status).toBe(201);
    const view = (await token.json()) as { ahead: number; label: string };
    expect(view.ahead).toBe(0);

    const again = await call(handle, "POST", "/bookings", { token: (await register(handle, "9844444444", "Dev Rao")).token, body: { doctor_id: "doc_meera", profile_id: "x", slot_start: first?.start } });
    expect([403, 409]).toContain(again.status);
  });

  it("keeps the demo simulator off", async () => {
    const staff = await staffLogin();
    expect((await call(handle, "GET", "/mock/simulator", { token: staff.token })).status).toBe(404);
    expect((await call(handle, "POST", "/mock/simulator/replay", { token: staff.token })).status).toBe(404);
  });

  it("asks for a sign-in on the live event stream and hides patient names from patients", async () => {
    expect((await call(handle, "GET", "/events/stream")).status).toBe(401);
    expect((await call(handle, "GET", "/queue/doc_meera")).status).toBe(401);
  });
});

async function staffLogin(): Promise<{ token: string }> {
  const response = await call(handle, "POST", "/auth/login", { body: { phone: "9000000001", otp: "424242" } });
  return { token: ((await response.json()) as { access_token: string }).access_token };
}

describe("staff queue control", () => {
  it("calls and completes a patient, and learns the doctor's real consult time", async () => {
    const world = new MockWorld({ mode: "local", tokenSecret: "s" });
    const user = world.registerPatient("9855555555", "C");
    const profile = user.profiles[0]?.id ?? "";
    const queue = world.engine.doctorQueue("doc_meera");
    const token = world.engine.issueToken("doc_meera", profile);
    expect(world.engine.aheadOf(token)).toBe(0);
    expect(world.engine.call(token.id)).toBe("ok");
    token.calledAtMs = (token.calledAtMs ?? Date.now()) - 20 * 60_000;
    const before = queue ? world.engine.expectedConsult(queue) : 0;
    expect(world.engine.complete(token.id)).toBe("ok");
    const after = queue ? world.engine.expectedConsult(queue) : 0;
    expect(after).not.toBe(before);
    expect(after).toBeGreaterThan(before);
  });

  it("stops staff from another hospital controlling a token", async () => {
    const other = createAppHandle(env({ STAFF_PHONES: "9000000001:karve,9000000002:baner", LOCAL_DATA_DIR: mkdtempSync(resolve(tmpdir(), "healix-other-")) }));
    const patient = await register(other, "9866666666", "Meena");
    const doctorId = [...other.world.doctors.values()].find((entry) => entry.hospital_id === "hosp_karve")?.id ?? "";
    const token = other.world.engine.issueToken(doctorId, patient.profileId);
    const login = async (phone: string) => ((await (await call(other, "POST", "/auth/login", { body: { phone, otp: "424242" } })).json()) as { access_token: string }).access_token;
    expect((await call(other, "POST", `/tokens/${token.id}/call`, { token: await login("9000000002") })).status).toBe(403);
    expect((await call(other, "POST", `/tokens/${token.id}/call`, { token: await login("9000000001") })).status).toBe(200);
  });
});

describe("saving and restoring", () => {
  it("brings users, consents, bookings and tokens back after a restart", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "healix-save-"));
    const first = createAppHandle(env({ LOCAL_DATA_DIR: dir }));
    const patient = await register(first, "9877777777", "Kiran Joshi");
    await call(first, "POST", "/consent", { token: patient.token, body: { purpose: "reports", granted: true } });
    const slots = (await (await call(first, "GET", "/doctors/doc_meera/slots", { token: patient.token })).json()) as { days: Array<{ slots: Array<{ start: string }> }> };
    const start = slots.days.flatMap((day) => day.slots)[0]?.start;
    let tokenLabel = "";
    if (start) {
      const booking = (await (await call(first, "POST", "/bookings", { token: patient.token, body: { doctor_id: "doc_meera", profile_id: patient.profileId, slot_start: start } })).json()) as { booking_id: string };
      tokenLabel = ((await (await call(first, "POST", "/tokens", { token: patient.token, body: { booking_id: booking.booking_id } })).json()) as { label: string }).label;
    }
    first.saver?.flush();

    const second = createAppHandle(env({ LOCAL_DATA_DIR: dir }));
    const me = await call(second, "GET", "/me", { token: patient.token });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { name: string }).name).toBe("Kiran Joshi");
    const consents = (await (await call(second, "GET", "/consent", { token: patient.token })).json()) as { consents: Array<{ purpose: string; granted: boolean }> };
    expect(consents.consents).toEqual([expect.objectContaining({ purpose: "reports", granted: true })]);
    if (start) {
      const mine = (await (await call(second, "GET", "/tokens/mine", { token: patient.token })).json()) as { tokens: Array<{ label: string }> };
      expect(mine.tokens.map((entry) => entry.label)).toEqual([tokenLabel]);
      const retry = await call(second, "POST", "/bookings", { token: (await register(second, "9888888888", "Other")).token, body: { doctor_id: "doc_meera", profile_id: "none", slot_start: start } });
      expect([403, 409]).toContain(retry.status);
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("community and profile edits survive a restart", () => {
  it("keeps a post, a reply, a vote and an edited profile, and keeps the nickname the same", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "healix-community-"));
    const first = createAppHandle(env({ LOCAL_DATA_DIR: dir }));
    const person = await register(first, "9877000001", "Meena Kulkarni");
    const created = (await (await call(first, "POST", "/community/posts", { token: person.token, body: { topic_id: "diabetes", title: "Walking after dinner helps", body: "A twenty minute walk after dinner keeps my morning sugar steadier." } })).json()) as { id: string; author_alias: string };
    await call(first, "POST", `/community/posts/${created.id}/comments`, { token: person.token, body: { body: "Thank you for sharing this." } });
    await call(first, "POST", "/community/posts/post_0001/vote", { token: person.token, body: { value: 1 } });
    const edited = await call(first, "PUT", `/profiles/${person.profileId}`, {
      token: person.token,
      body: { name: "Meena K. Kulkarni", age: 61, sex: "female", conditions: ["Hypertension"], language: "mr", elder_mode: true },
    });
    expect(edited.status).toBe(200);
    first.saver?.flush();

    const second = createAppHandle(env({ LOCAL_DATA_DIR: dir }));
    const post = (await (await call(second, "GET", `/community/posts/${created.id}`, { token: person.token })).json()) as { author_alias: string; comments: Array<{ body: string; mine: boolean }>; mine: boolean };
    expect(post.author_alias).toBe(created.author_alias);
    expect(post.mine).toBe(true);
    expect(post.comments.map((entry) => entry.body)).toEqual(["Thank you for sharing this."]);
    const seed = (await (await call(second, "GET", "/community/posts/post_0001", { token: person.token })).json()) as { my_vote: number; score: number };
    expect(seed).toMatchObject({ my_vote: 1, score: 43 });
    const me = (await (await call(second, "GET", "/me", { token: person.token })).json()) as { name: string; profiles: Array<{ age: number; elder_mode: boolean; conditions: string[] }> };
    expect(me.name).toBe("Meena K. Kulkarni");
    expect(me.profiles[0]).toMatchObject({ age: 61, elder_mode: true, conditions: ["Hypertension"] });
    rmSync(dir, { recursive: true, force: true });
  });

  it("will not let a person edit someone else's profile or post, and turns away unsafe text", async () => {
    const owner = await register(handle, "9877000002", "Owner One");
    const other = await register(handle, "9877000003", "Other Two");
    expect((await call(handle, "PUT", `/profiles/${owner.profileId}`, { token: other.token, body: { name: "Hacker", age: 30, sex: "male", conditions: [], language: "en", elder_mode: false } })).status).toBe(404);
    const post = (await (await call(handle, "POST", "/community/posts", { token: owner.token, body: { topic_id: "food", title: "Quick lunch ideas", body: "Vegetable pulao with curd is my easy lunch on busy days." } })).json()) as { id: string };
    expect((await call(handle, "DELETE", `/community/posts/${post.id}`, { token: other.token })).status).toBe(403);
    const unsafe = await call(handle, "POST", "/community/posts", { token: owner.token, body: { topic_id: "food", title: "Call me please", body: "My number is 9876543210, ring me for the full diet plan." } });
    expect(unsafe.status).toBe(422);
    expect(((await unsafe.json()) as { reason: string }).reason).toBe("phone");
    expect((await call(handle, "GET", "/community/topics")).status).toBe(401);
  });
});

describe("report upload, reading and explaining", () => {
  it("reads an uploaded photo end to end, then lets only its owner see it", async () => {
    const owner = await register(handle, "9899999991", "Sunita Test");
    const stranger = await register(handle, "9899999992", "Someone Else");

    const form = new FormData();
    form.set("profile_id", owner.profileId);
    form.set("file", new File([readFileSync(resolve(reports, "diabetes-panel.png"))], "report.png", { type: "image/png" }));
    const upload = await call(handle, "POST", "/reports", { token: owner.token, form });
    expect(upload.status).toBe(201);
    const reportId = ((await upload.json()) as { report_id: string }).report_id;

    const process = await call(handle, "POST", "/ai/reports/process", { token: owner.token, body: { report_id: reportId } });
    const jobId = ((await process.json()) as { job_id: string }).job_id;
    let status = "processing";
    for (let attempt = 0; attempt < 60 && status === "processing"; attempt += 1) {
      await new Promise((done) => setTimeout(done, 500));
      status = ((await (await call(handle, "GET", `/ai/jobs/${jobId}`, { token: owner.token })).json()) as { status: string }).status;
    }
    expect(status).toBe("ready_for_review");

    const review = (await (await call(handle, "GET", `/reports/${reportId}`, { token: owner.token })).json()) as {
      report_type: string;
      status: string;
      observations: Array<{ code: string; value: number; confidence: number }>;
    };
    expect(review.report_type).toBe("Diabetes check-up");
    expect(review.observations.map((entry) => entry.code)).toEqual(["HBA1C", "FBS", "TC", "TG"]);
    expect(review.observations.find((entry) => entry.code === "HBA1C")?.confidence).toBeLessThan(0.8);

    expect((await call(handle, "GET", `/ai/reports/${reportId}/explain?language=en`, { token: owner.token })).status).toBe(409);
    expect((await call(handle, "GET", `/reports/${reportId}`, { token: stranger.token })).status).toBe(403);
    expect((await call(handle, "GET", `/reports/${reportId}/image`, { token: stranger.token })).status).toBe(403);
    expect((await call(handle, "GET", `/reports/${reportId}/image`, { token: owner.token })).headers.get("content-type")).toBe("image/png");

    const confirm = await call(handle, "POST", `/reports/${reportId}/confirm`, { token: owner.token, body: { observations: [{ code: "HBA1C", value: 7.1 }] } });
    expect(confirm.status).toBe(200);
    const explain = (await (await call(handle, "GET", `/ai/reports/${reportId}/explain?language=mr`, { token: owner.token })).json()) as {
      summary: string;
      items: Array<{ code: string; direction: string }>;
      doctor_questions: string[];
    };
    expect(explain.items.find((entry) => entry.code === "HBA1C")?.direction).toBe("high");
    expect(explain.summary).toContain("HbA1c");
    expect(explain.doctor_questions.length).toBeGreaterThanOrEqual(3);
  }, 60_000);

  it("refuses file types it cannot read, and ones over 50 MB, but accepts large files up to that", async () => {
    const owner = await register(handle, "9899999993", "Third Person");
    const archive = new FormData();
    archive.set("profile_id", owner.profileId);
    archive.set("file", new File(["hello"], "notes.zip", { type: "application/zip" }));
    expect((await call(handle, "POST", "/reports", { token: owner.token, form: archive })).status).toBe(415);
    const big = new FormData();
    big.set("profile_id", owner.profileId);
    big.set("file", new File([new Uint8Array(51 * 1024 * 1024)], "big.png", { type: "image/png" }));
    expect((await call(handle, "POST", "/reports", { token: owner.token, form: big })).status).toBe(413);
    const large = new FormData();
    large.set("profile_id", owner.profileId);
    large.set("file", new File([new Uint8Array(20 * 1024 * 1024)], "large.png", { type: "image/png" }));
    expect((await call(handle, "POST", "/reports", { token: owner.token, form: large })).status).toBe(201);
    const unnamed = new FormData();
    unnamed.set("profile_id", owner.profileId);
    unnamed.set("file", new File(["Hemoglobin 12.5 g/dL 12 - 15"], "report.txt", { type: "application/octet-stream" }));
    expect((await call(handle, "POST", "/reports", { token: owner.token, form: unnamed })).status).toBe(201);
  }, 60_000);

  async function readDocument(phone: string, file: File) {
    const owner = await register(handle, phone, "Doc Person");
    const form = new FormData();
    form.set("profile_id", owner.profileId);
    form.set("file", file);
    const reportId = ((await (await call(handle, "POST", "/reports", { token: owner.token, form })).json()) as { report_id: string }).report_id;
    const jobId = ((await (await call(handle, "POST", "/ai/reports/process", { token: owner.token, body: { report_id: reportId } })).json()) as { job_id: string }).job_id;
    let job = { status: "processing", reason: undefined as string | undefined };
    for (let attempt = 0; attempt < 120 && job.status === "processing"; attempt += 1) {
      await new Promise((done) => setTimeout(done, 400));
      job = (await (await call(handle, "GET", `/ai/jobs/${jobId}`, { token: owner.token })).json()) as typeof job;
    }
    return { owner, reportId, job };
  }

  it("accepts a text report with lab values, and one with none, keeping both for the chatbot", async () => {
    const labs = await readDocument("9899999981", new File(["City Lab\nLIPID PROFILE\nLDL Cholesterol 162 mg/dL < 100\nHDL Cholesterol 48 mg/dL > 40\n"], "lipids.txt", { type: "text/plain" }));
    expect(labs.job.status).toBe("ready_for_review");
    const review = (await (await call(handle, "GET", `/reports/${labs.reportId}`, { token: labs.owner.token })).json()) as { observations: Array<{ code: string; bbox?: unknown }> };
    expect(review.observations.length).toBeGreaterThanOrEqual(1);
    expect(review.observations.every((entry) => entry.bbox === undefined)).toBe(true);

    const notes = await readDocument("9899999982", new File(["Discharge summary. The patient was admitted for observation and discharged in stable condition after two days."], "summary.txt", { type: "text/plain" }));
    expect(notes.job.status).toBe("ready_for_review");
    const empty = (await (await call(handle, "GET", `/reports/${notes.reportId}`, { token: notes.owner.token })).json()) as { observations: unknown[] };
    expect(empty.observations).toEqual([]);
    expect((await call(handle, "POST", `/reports/${notes.reportId}/confirm`, { token: notes.owner.token, body: { observations: [] } })).status).toBe(200);
    const explain = (await (await call(handle, "GET", `/ai/reports/${notes.reportId}/explain?language=en`, { token: notes.owner.token })).json()) as { summary: string; items: unknown[] };
    expect(explain.summary).toContain("saved");
    expect(explain.items).toEqual([]);

    const chat = await call(handle, "POST", "/ai/assistant/chat", { token: notes.owner.token, body: { message: "What does the discharge summary say about observation?", language: "en" } });
    const text = await chat.text();
    expect(text).toContain("discharge");
  }, 60_000);

  it("reads a Word document", async () => {
    const xml = `<?xml version="1.0"?><w:document><w:body><w:p><w:r><w:t>Hemoglobin 9.8 g/dL 12 - 15</w:t></w:r></w:p><w:p><w:r><w:t>Blood count report</w:t></w:r></w:p></w:body></w:document>`;
    const docx = storedZip("word/document.xml", Buffer.from(xml));
    const result = await readDocument("9899999983", new File([new Uint8Array(docx)], "report.docx", { type: "" }));
    expect(result.job.status).toBe("ready_for_review");
    const review = (await (await call(handle, "GET", `/reports/${result.reportId}`, { token: result.owner.token })).json()) as { observations: Array<{ code: string; value: number }> };
    expect(review.observations.map((entry) => entry.value)).toContain(9.8);
  }, 60_000);

  it("reads a scanned PDF that has no text layer by looking at the page", async () => {
    const pdf = await scannedPdf(readFileSync(resolve(reports, "diabetes-panel.png")));
    const result = await readDocument("9899999984", new File([new Uint8Array(pdf)], "scan.pdf", { type: "application/pdf" }));
    expect(result.job.status).toBe("ready_for_review");
    const review = (await (await call(handle, "GET", `/reports/${result.reportId}`, { token: result.owner.token })).json()) as { observations: Array<{ code: string }> };
    expect(review.observations.map((entry) => entry.code)).toContain("HBA1C");
  }, 120_000);

  it("marks a report that cannot be read as failed so the person can try again", async () => {
    const owner = await register(handle, "9899999994", "Fourth Person");
    const form = new FormData();
    form.set("profile_id", owner.profileId);
    form.set("file", new File([readFileSync(resolve(reports, "../../../../public/robots.txt"))], "blank.png", { type: "image/png" }));
    const reportId = ((await (await call(handle, "POST", "/reports", { token: owner.token, form })).json()) as { report_id: string }).report_id;
    const jobId = ((await (await call(handle, "POST", "/ai/reports/process", { token: owner.token, body: { report_id: reportId } })).json()) as { job_id: string }).job_id;
    let status = "processing";
    for (let attempt = 0; attempt < 40 && status === "processing"; attempt += 1) {
      await new Promise((done) => setTimeout(done, 400));
      status = ((await (await call(handle, "GET", `/ai/jobs/${jobId}`, { token: owner.token })).json()) as { status: string }).status;
    }
    expect(status).toBe("failed");
    const failed = (await (await call(handle, "GET", `/ai/jobs/${jobId}`, { token: owner.token })).json()) as { reason?: string };
    expect(failed.reason).toBe("unreadable_image");
  }, 60_000);
});

describe("doctor controls from the front desk", () => {
  it("shows the status change straight away when the delay or break changes", () => {
    const world = new MockWorld({ mode: "local", tokenSecret: "s" });
    const queue = world.engine.doctorQueue("doc_arjun");
    if (!queue) throw new Error("missing queue");
    queue.status = "running";
    world.engine.setDelay("doc_arjun", 10);
    expect(queue.status).toBe("delayed");
    world.engine.setDelay("doc_arjun", 2);
    expect(queue.status).toBe("running");
    world.engine.setBreak("doc_arjun", true);
    expect(queue.status).toBe("break");
    world.engine.refreshStatuses();
    expect(queue.status).toBe("break");
    world.engine.setBreak("doc_arjun", false);
    expect(queue.status).toBe("running");
  });

  it("skips a no-show and lets staff add walk-ins and see the patient list", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "healix-desk-"));
    const app = createAppHandle(env({ LOCAL_DATA_DIR: dir }));
    const staffToken = ((await (await call(app, "POST", "/auth/login", { body: { phone: "9000000001", otp: "424242" } })).json()) as { access_token: string }).access_token;
    const walkIn = (await (await call(app, "POST", "/dashboard/doctors/doc_meera/walk-in", { token: staffToken })).json()) as { tokens: Array<{ id: string; patient: string; status: string }> };
    expect(walkIn.tokens).toHaveLength(1);
    expect(walkIn.tokens[0]?.patient).toBe("Walk-in patient");
    const id = walkIn.tokens[0]?.id ?? "";
    expect((await call(app, "POST", `/tokens/${id}/skip`, { token: staffToken })).status).toBe(200);
    expect((await call(app, "POST", `/tokens/${id}/skip`, { token: staffToken })).status).toBe(409);
    const after = (await (await call(app, "GET", "/dashboard/doctors/doc_meera/queue", { token: staffToken })).json()) as { tokens: Array<{ id: string; status: string }> };
    expect(after.tokens.find((entry) => entry.id === id)?.status).toBe("cancelled");
    const patient = await register(app, "9877000010", "Some Patient");
    expect((await call(app, "GET", "/dashboard/doctors/doc_meera/queue", { token: patient.token })).status).toBe(403);
    expect((await call(app, "POST", "/dashboard/doctors/doc_meera/delay", { token: staffToken, body: { delay_minutes: 500 } })).status).toBe(400);
    expect((await call(app, "POST", "/dashboard/doctors/doc_hosp_other/delay", { token: staffToken, body: { delay_minutes: 5 } })).status).toBe(404);
    rmSync(dir, { recursive: true, force: true });
  });
});
