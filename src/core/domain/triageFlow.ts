import type { TriageResponse } from "../api/schemas/ai";
import type { LanguageCode } from "../i18n/languages";
import { maxFollowUpRounds, normalizeFollowUps, type FollowUp } from "./triage";

export type TriageStage = "compose" | "loading" | "followup" | "result" | "emergency" | "error";

export interface TriageAnswer {
  question: string;
  answer: string;
}

export interface TriageFlowState {
  stage: TriageStage;
  submittedText: string;
  result: TriageResponse | null;
  followUps: FollowUp[];
  answers: TriageAnswer[];
  rounds: number;
  errorCode: string | null;
  canRetry: boolean;
  generation: number;
}

export type TriageFlowAction =
  | { type: "started"; text: string }
  | { type: "answered"; answers: TriageAnswer[] }
  | { type: "responded"; result: TriageResponse; language: LanguageCode; generation: number }
  | { type: "failed"; code: string; retry: boolean; generation: number }
  | { type: "reset" };

export const initialTriageFlow: TriageFlowState = {
  stage: "compose",
  submittedText: "",
  result: null,
  followUps: [],
  answers: [],
  rounds: 0,
  errorCode: null,
  canRetry: false,
  generation: 0,
};

export function isEmergency(result: Pick<TriageResponse, "urgency" | "red_flags">): boolean {
  return result.urgency === "emergency" || result.red_flags.length > 0;
}

export function triageReducer(state: TriageFlowState, action: TriageFlowAction): TriageFlowState {
  switch (action.type) {
    case "started":
      return { ...initialTriageFlow, stage: "loading", submittedText: action.text, generation: state.generation + 1 };
    case "answered":
      return {
        ...state,
        stage: "loading",
        answers: action.answers,
        rounds: state.rounds + 1,
        errorCode: null,
        generation: state.generation + 1,
      };
    case "responded": {
      if (action.generation !== state.generation) return state;
      if (isEmergency(action.result)) {
        return { ...state, stage: "emergency", result: action.result, followUps: [], errorCode: null };
      }
      const followUps = normalizeFollowUps(action.result.follow_up_questions, action.language);
      const mayAsk = followUps.length > 0 && state.rounds < maxFollowUpRounds;
      return {
        ...state,
        stage: mayAsk ? "followup" : "result",
        result: action.result,
        followUps: mayAsk ? followUps : [],
        errorCode: null,
      };
    }
    case "failed":
      if (action.generation !== state.generation) return state;
      return { ...state, stage: "error", errorCode: action.code, canRetry: action.retry };
    case "reset":
      return { ...initialTriageFlow, generation: state.generation + 1 };
  }
}
