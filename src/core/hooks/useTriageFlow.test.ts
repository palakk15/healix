import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../api/error";
import type { TriageRequest, TriageResponse } from "../api/schemas/ai";
import { useTriageFlow, type TriageClient } from "./useTriageFlow";

const request: TriageRequest = { text: "सिर में दर्द", age: 58, sex: "female" };

const result = (overrides: Partial<TriageResponse> = {}): TriageResponse => ({
  language: "hi",
  session_id: "sess_1",
  specialty: "General Physician",
  urgency: "soon",
  reasoning: ["a", "b", "c"],
  follow_up_questions: [],
  red_flags: [],
  confidence: 0.6,
  ...overrides,
});

function client(overrides: Partial<TriageClient> = {}): TriageClient {
  return { triage: vi.fn(async () => result()), answerTriage: vi.fn(async () => result()), ...overrides };
}

describe("useTriageFlow", () => {
  it("goes from compose to a result", async () => {
    const stub = client();
    const { result: hook } = renderHook(() => useTriageFlow("hi", stub));
    expect(hook.current.state.stage).toBe("compose");
    await act(async () => hook.current.submit(request));
    expect(hook.current.state).toMatchObject({ stage: "result", submittedText: "सिर में दर्द" });
    expect(stub.triage).toHaveBeenCalledWith(request);
  });

  it("walks a follow-up through to the answer, sending the session and all answers", async () => {
    const question = { question: "Sudden?", options: ["Yes", "No"] };
    const stub = client({
      triage: vi.fn(async () => result({ follow_up_questions: [question] })),
      answerTriage: vi.fn(async () => result({ urgency: "soon", follow_up_questions: [] })),
    });
    const { result: hook } = renderHook(() => useTriageFlow("hi", stub));
    await act(async () => hook.current.submit(request));
    expect(hook.current.state.stage).toBe("followup");

    await act(async () => hook.current.answer("Sudden?", "No"));
    expect(stub.answerTriage).toHaveBeenCalledWith({ session_id: "sess_1", answers: [{ question: "Sudden?", answer: "No" }] });
    expect(hook.current.state.stage).toBe("result");
  });

  it("goes straight to the emergency stage for a red flag", async () => {
    const stub = client({ triage: vi.fn(async () => result({ urgency: "emergency", red_flags: ["Chest pain with sweating"] })) });
    const { result: hook } = renderHook(() => useTriageFlow("en", stub));
    await act(async () => hook.current.submit({ ...request, text: "chest pain and sweating" }));
    expect(hook.current.state.stage).toBe("emergency");
  });

  it("reports failures with the retry flag, then retries the same request", async () => {
    const triage = vi.fn().mockRejectedValueOnce(new ApiError("network_error", "x", true, 0)).mockResolvedValueOnce(result());
    const { result: hook } = renderHook(() => useTriageFlow("en", client({ triage })));
    await act(async () => hook.current.submit(request));
    expect(hook.current.state).toMatchObject({ stage: "error", errorCode: "network_error", canRetry: true });
    await act(async () => hook.current.retry());
    expect(triage).toHaveBeenCalledTimes(2);
    expect(triage).toHaveBeenLastCalledWith(request);
    expect(hook.current.state.stage).toBe("result");
  });

  it("treats an unexpected error as retryable", async () => {
    const { result: hook } = renderHook(() => useTriageFlow("en", client({ triage: vi.fn(async () => Promise.reject(new Error("boom"))) })));
    await act(async () => hook.current.submit(request));
    expect(hook.current.state).toMatchObject({ stage: "error", errorCode: "unknown_error", canRetry: true });
  });

  it("ignores a second submit while one is already running", async () => {
    let release: (value: TriageResponse) => void = () => undefined;
    const triage = vi.fn(() => new Promise<TriageResponse>((resolve) => (release = resolve)));
    const { result: hook } = renderHook(() => useTriageFlow("en", client({ triage })));
    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = hook.current.submit(request);
    });
    await act(async () => hook.current.submit(request));
    expect(triage).toHaveBeenCalledTimes(1);
    await act(async () => {
      release(result());
      await first;
    });
    expect(hook.current.state.stage).toBe("result");
  });

  it("drops a late answer after the person starts over", async () => {
    let release: (value: TriageResponse) => void = () => undefined;
    const triage = vi.fn(() => new Promise<TriageResponse>((resolve) => (release = resolve)));
    const { result: hook } = renderHook(() => useTriageFlow("en", client({ triage })));
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = hook.current.submit(request);
    });
    act(() => hook.current.reset());
    await act(async () => {
      release(result());
      await pending;
    });
    expect(hook.current.state.stage).toBe("compose");
    expect(hook.current.state.result).toBeNull();
  });

  it("only answers while a question is open", async () => {
    const stub = client();
    const { result: hook } = renderHook(() => useTriageFlow("en", stub));
    await act(async () => hook.current.answer("q", "a"));
    expect(stub.answerTriage).not.toHaveBeenCalled();
  });
});
