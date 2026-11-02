import { useCallback, useReducer, useRef } from "react";
import { ai as defaultAi } from "../api/ai";
import { ApiError } from "../api/error";
import type { TriageRequest, TriageResponse } from "../api/schemas/ai";
import { initialTriageFlow, triageReducer, type TriageAnswer, type TriageFlowState } from "../domain/triageFlow";
import { isLanguageCode, type LanguageCode } from "../i18n/languages";

export interface TriageClient {
  triage: (request: TriageRequest) => Promise<TriageResponse>;
  answerTriage: (request: { session_id: string; answers: TriageAnswer[] }) => Promise<TriageResponse>;
}

function describeFailure(cause: unknown): { code: string; retry: boolean } {
  if (cause instanceof ApiError) return { code: cause.code, retry: cause.retry };
  return { code: "unknown_error", retry: true };
}

export function useTriageFlow(language: LanguageCode, client: TriageClient = defaultAi) {
  const [state, dispatch] = useReducer(triageReducer, initialTriageFlow);
  const generation = useRef(0);
  const stateRef = useRef<TriageFlowState>(state);
  stateRef.current = state;
  const lastRequest = useRef<TriageRequest | null>(null);

  const submit = useCallback(
    async (request: TriageRequest) => {
      if (stateRef.current.stage === "loading") return;
      lastRequest.current = request;
      generation.current = stateRef.current.generation + 1;
      const mine = generation.current;
      dispatch({ type: "started", text: request.text });
      try {
        const result = await client.triage(request);
        dispatch({ type: "responded", result, language: isLanguageCode(result.language) ? result.language : language, generation: mine });
      } catch (cause) {
        const failure = describeFailure(cause);
        dispatch({ type: "failed", code: failure.code, retry: failure.retry, generation: mine });
      }
    },
    [client, language],
  );

  const answer = useCallback(
    async (question: string, chosen: string) => {
      const current = stateRef.current;
      const sessionId = current.result?.session_id;
      if (current.stage !== "followup" || !sessionId) return;
      const answers = [...current.answers, { question, answer: chosen }];
      generation.current = current.generation + 1;
      const mine = generation.current;
      dispatch({ type: "answered", answers });
      try {
        const result = await client.answerTriage({ session_id: sessionId, answers });
        dispatch({ type: "responded", result, language: isLanguageCode(result.language) ? result.language : language, generation: mine });
      } catch (cause) {
        const failure = describeFailure(cause);
        dispatch({ type: "failed", code: failure.code, retry: failure.retry, generation: mine });
      }
    },
    [client, language],
  );

  const retry = useCallback(async () => {
    if (lastRequest.current) await submit(lastRequest.current);
  }, [submit]);

  const reset = useCallback(() => {
    lastRequest.current = null;
    dispatch({ type: "reset" });
  }, []);

  return { state, submit, answer, retry, reset };
}
