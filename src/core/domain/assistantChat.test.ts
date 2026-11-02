import { describe, expect, it } from "vitest";
import { chatReducer, historyFor, initialChat, isBusy, type AssistantMessage } from "./assistantChat";
import { splitCitations, stripCitations } from "./citations";

const asked = chatReducer(initialChat, { type: "ask", userId: "u1", answerId: "a1", text: "What is HbA1c?" });
const last = (state: typeof asked) => state.messages[state.messages.length - 1] as AssistantMessage;

describe("citations", () => {
  it("splits markers into chips and text", () => {
    expect(splitCitations("One [1] two [2].")).toEqual([
      { kind: "text", value: "One " },
      { kind: "cite", n: 1 },
      { kind: "text", value: " two " },
      { kind: "cite", n: 2 },
      { kind: "text", value: "." },
    ]);
    expect(splitCitations("plain")).toEqual([{ kind: "text", value: "plain" }]);
  });

  it("removes markers before reading aloud", () => {
    expect(stripCitations("Sugar is steady [1] . Walk daily [2].")).toBe("Sugar is steady. Walk daily.");
  });
});

describe("chat reducer", () => {
  it("adds the question and an empty streaming answer", () => {
    expect(asked.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(isBusy(asked)).toBe(true);
  });

  it("streams tokens, then citations, then finishes", () => {
    let state = chatReducer(asked, { type: "token", text: "It shows " });
    state = chatReducer(state, { type: "token", text: "sugar [1]." });
    state = chatReducer(state, { type: "citations", citations: [{ n: 1, title: "ICMR", section: "HbA1c", page: 9, url: "https://x", year: 2022 }] });
    state = chatReducer(state, { type: "done", disclaimer: "Guidance.", language: "en" });
    expect(last(state)).toMatchObject({ text: "It shows sugar [1].", status: "done", disclaimer: "Guidance." });
    expect(last(state).citations).toHaveLength(1);
    expect(isBusy(state)).toBe(false);
  });

  it("keeps a refusal as a refusal after done", () => {
    let state = chatReducer(asked, { type: "refusal", message: "Please ask a doctor.", reason: "no_verified_source" });
    state = chatReducer(state, { type: "done" });
    expect(last(state).status).toBe("refused");
    expect(last(state).refusal?.message).toBe("Please ask a doctor.");
  });

  it("marks a broken stream as failed and leaves history to finished answers only", () => {
    const failed = chatReducer(chatReducer(asked, { type: "token", text: "Partial" }), { type: "failed" });
    expect(last(failed).status).toBe("failed");
    expect(historyFor(failed)).toEqual([{ role: "user", content: "What is HbA1c?" }]);
  });

  it("ignores events when nothing is being answered", () => {
    expect(chatReducer(initialChat, { type: "token", text: "x" })).toBe(initialChat);
  });
});
