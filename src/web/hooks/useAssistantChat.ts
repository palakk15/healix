import { useCallback, useEffect, useReducer, useRef } from "react";
import { streamAssistantChat } from "@core/api/streams";
import { chatReducer, historyFor, initialChat, isBusy } from "@core/domain/assistantChat";
import type { LanguageCode } from "@core/i18n/languages";

let counter = 0;
const nextId = (prefix: string) => `${prefix}_${(counter += 1)}`;

export function useAssistantChat(language: LanguageCode) {
  const [state, dispatch] = useReducer(chatReducer, initialChat);
  const stateRef = useRef(state);
  const controller = useRef<AbortController | null>(null);
  stateRef.current = state;

  useEffect(() => () => controller.current?.abort(), []);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (question.length === 0 || isBusy(stateRef.current)) return;
      const history = historyFor(stateRef.current);
      dispatch({ type: "ask", userId: nextId("q"), answerId: nextId("a"), text: question });
      const abort = new AbortController();
      controller.current = abort;
      try {
        await streamAssistantChat(
          { message: question, language, history },
          {
            onToken: (token) => dispatch({ type: "token", text: token }),
            onCitations: (citations) => dispatch({ type: "citations", citations }),
            onRefusal: (message, reason) => dispatch({ type: "refusal", message, reason }),
            onDone: (envelope) => dispatch({ type: "done", disclaimer: envelope.disclaimer, language: envelope.language, model: envelope.model }),
          },
          abort.signal,
        );
        dispatch({ type: "done" });
      } catch (cause) {
        if (abort.signal.aborted) return;
        void cause;
        dispatch({ type: "failed" });
      }
    },
    [language],
  );

  const stop = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: "done" });
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { messages: state.messages, busy: isBusy(state), ask, stop, reset };
}
