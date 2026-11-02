import type { Citation } from "../api/schemas/ai";

export type AnswerStatus = "streaming" | "done" | "refused" | "failed";

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: "assistant";
  text: string;
  citations: Citation[];
  status: AnswerStatus;
  refusal?: { message: string; reason?: string };
  disclaimer?: string;
  language?: string;
  model?: string;
}

export type ChatMessage = UserMessage | AssistantMessage;

export interface ChatState {
  messages: ChatMessage[];
}

export type ChatAction =
  | { type: "ask"; userId: string; answerId: string; text: string }
  | { type: "token"; text: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "refusal"; message: string; reason?: string }
  | { type: "done"; disclaimer?: string; language?: string; model?: string }
  | { type: "failed" }
  | { type: "reset" };

export const initialChat: ChatState = { messages: [] };

function updateLastAnswer(state: ChatState, update: (message: AssistantMessage) => AssistantMessage): ChatState {
  const index = state.messages.length - 1;
  const last = state.messages[index];
  if (!last || last.role !== "assistant") return state;
  const messages = state.messages.slice();
  messages[index] = update(last);
  return { messages };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ask":
      return {
        messages: [
          ...state.messages,
          { id: action.userId, role: "user", text: action.text },
          { id: action.answerId, role: "assistant", text: "", citations: [], status: "streaming" },
        ],
      };
    case "token":
      return updateLastAnswer(state, (message) => ({ ...message, text: message.text + action.text }));
    case "citations":
      return updateLastAnswer(state, (message) => ({ ...message, citations: action.citations }));
    case "refusal":
      return updateLastAnswer(state, (message) => ({ ...message, status: "refused", refusal: { message: action.message, reason: action.reason } }));
    case "done":
      return updateLastAnswer(state, (message) => ({
        ...message,
        status: message.status === "refused" ? "refused" : "done",
        disclaimer: action.disclaimer ?? message.disclaimer,
        language: action.language ?? message.language,
        model: action.model ?? message.model,
      }));
    case "failed":
      return updateLastAnswer(state, (message) => ({ ...message, status: "failed" }));
    case "reset":
      return initialChat;
  }
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export function historyFor(state: ChatState, limit = 6): HistoryTurn[] {
  return state.messages
    .flatMap((message): HistoryTurn[] => {
      if (message.role === "user") return [{ role: "user", content: message.text }];
      if (message.status === "done" && message.text) return [{ role: "assistant", content: message.text }];
      return [];
    })
    .slice(-limit);
}

export function isBusy(state: ChatState): boolean {
  const last = state.messages[state.messages.length - 1];
  return last?.role === "assistant" && last.status === "streaming";
}
