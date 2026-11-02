import { describe, expect, it } from "vitest";
import type { TriageResponse } from "../api/schemas/ai";
import { initialTriageFlow, isEmergency, triageReducer, type TriageFlowState } from "./triageFlow";

const base: TriageResponse = {
  language: "en",
  session_id: "sess_1",
  specialty: "General Physician",
  urgency: "soon",
  reasoning: ["a", "b", "c"],
  follow_up_questions: [],
  red_flags: [],
  confidence: 0.7,
};

const withQuestion: TriageResponse = { ...base, follow_up_questions: [{ question: "Sudden?", options: ["Yes", "No"] }] };

function run(state: TriageFlowState, ...steps: Array<(current: TriageFlowState) => Parameters<typeof triageReducer>[1]>) {
  return steps.reduce((current, step) => triageReducer(current, step(current)), state);
}

describe("triage flow", () => {
  it("moves from compose to loading to a result", () => {
    const loading = triageReducer(initialTriageFlow, { type: "started", text: "pet dard" });
    expect(loading).toMatchObject({ stage: "loading", submittedText: "pet dard" });
    const done = triageReducer(loading, { type: "responded", result: base, language: "en", generation: loading.generation });
    expect(done).toMatchObject({ stage: "result", result: base, followUps: [] });
  });

  it("treats an emergency urgency or any red flag as an emergency, and clears questions", () => {
    expect(isEmergency({ urgency: "emergency", red_flags: [] })).toBe(true);
    expect(isEmergency({ urgency: "soon", red_flags: ["Fits"] })).toBe(true);
    expect(isEmergency({ urgency: "soon", red_flags: [] })).toBe(false);
    const state = run(
      initialTriageFlow,
      () => ({ type: "started", text: "x" }),
      (current) => ({ type: "responded", result: { ...withQuestion, red_flags: ["Chest pain"] }, language: "en", generation: current.generation }),
    );
    expect(state).toMatchObject({ stage: "emergency", followUps: [] });
  });

  it("asks follow-up questions with options for at most two rounds", () => {
    let state = run(
      initialTriageFlow,
      () => ({ type: "started", text: "headache" }),
      (current) => ({ type: "responded", result: withQuestion, language: "en", generation: current.generation }),
    );
    expect(state.stage).toBe("followup");
    expect(state.followUps).toEqual([{ question: "Sudden?", options: ["Yes", "No"] }]);

    state = run(
      state,
      () => ({ type: "answered", answers: [{ question: "Sudden?", answer: "No" }] }),
      (current) => ({ type: "responded", result: withQuestion, language: "en", generation: current.generation }),
    );
    expect(state).toMatchObject({ stage: "followup", rounds: 1 });

    state = run(
      state,
      () => ({ type: "answered", answers: [...state.answers, { question: "Sudden?", answer: "No" }] }),
      (current) => ({ type: "responded", result: withQuestion, language: "en", generation: current.generation }),
    );
    expect(state).toMatchObject({ stage: "result", rounds: 2, followUps: [] });
  });

  it("ignores a response that belongs to an older request", () => {
    const first = triageReducer(initialTriageFlow, { type: "started", text: "one" });
    const reset = triageReducer(first, { type: "reset" });
    const stale = triageReducer(reset, { type: "responded", result: base, language: "en", generation: first.generation });
    expect(stale).toEqual(reset);
    const failedStale = triageReducer(reset, { type: "failed", code: "x", retry: true, generation: first.generation });
    expect(failedStale).toEqual(reset);
  });

  it("records a failure with whether it can be retried, and resets cleanly", () => {
    const loading = triageReducer(initialTriageFlow, { type: "started", text: "x" });
    const failed = triageReducer(loading, { type: "failed", code: "network_error", retry: true, generation: loading.generation });
    expect(failed).toMatchObject({ stage: "error", errorCode: "network_error", canRetry: true });
    expect(triageReducer(failed, { type: "reset" })).toMatchObject({ stage: "compose", errorCode: null, result: null });
  });
});
