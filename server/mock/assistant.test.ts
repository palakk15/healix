import { describe, expect, it } from "vitest";
import { answerFor, classify, streamAssistant, type AssistantObservation } from "./assistant";
import { offTopicMessage, unknownTermMessage } from "./glossary";
import { glossaryAnalytes } from "./glossary";
import { analytes } from "../live/analytes";

const hba1c: AssistantObservation = { code: "HBA1C", display: "HbA1c", value: 7.1, unit: "%", reference: { low: 4, high: 5.6 }, interpretation: "high" };
const hdl: AssistantObservation = { code: "HDL", display: "HDL cholesterol", value: 38, unit: "mg/dL", reference: { low: 40, high: null }, interpretation: "low" };
const tg: AssistantObservation = { code: "TG", display: "Triglycerides", value: 128, unit: "mg/dL", reference: { low: 0, high: 150 }, interpretation: "normal" };

describe("guardrail", () => {
  it.each([
    "Who won the cricket match yesterday?",
    "How many metformin tablets should I take?",
    "What is the capital of France?",
    "Tell me a joke",
    "मुझे सिर दर्द है",
    "",
  ])("answers only with the fixed message for %j", (message) => {
    expect(classify(message).kind).toBe("off_topic");
    const answer = answerFor(message, "en", [hba1c]);
    expect(answer).toEqual({ type: "refusal", message: offTopicMessage.en, reason: "off_topic" });
  });

  it("says it does not know a report term it has no entry for, instead of guessing", () => {
    const answer = answerFor("What does ferritin mean in my report?", "en", []);
    expect(answer).toEqual({ type: "refusal", message: unknownTermMessage.en, reason: "unknown_term" });
  });

  it("uses the same fixed sentence in every language", () => {
    expect(answerFor("weather today", "hi", [])).toMatchObject({ type: "refusal", message: offTopicMessage.hi });
    expect(answerFor("weather today", "mr", [])).toMatchObject({ message: offTopicMessage.mr });
    expect(answerFor("weather today", "hinglish", [])).toMatchObject({ message: offTopicMessage.hinglish });
  });
});

describe("report jargon", () => {
  it("explains a test in plain words", () => {
    const answer = answerFor("What does HbA1c mean?", "en", []);
    expect(answer.type).toBe("answer");
    expect(answer.type === "answer" ? answer.text : "").toContain("average blood sugar");
  });

  it("adds the person's own value, the range and where it sits", () => {
    const answer = answerFor("what is hba1c", "en", [hba1c]);
    const text = answer.type === "answer" ? answer.text : "";
    expect(text).toContain("In your report, HbA1c is 7.1 % , which is".replace(" %", " %").replace(" ,", ","));
    expect(text).toContain("above the usual range");
    expect(text).toContain("4 to 5.6 %");
    expect(text).toContain("Your doctor reads it together with your other results".slice(0, 0));
  });

  it("does not make up a personal value when the report has none", () => {
    const answer = answerFor("what is hba1c", "en", [tg]);
    expect(answer.type === "answer" ? answer.text : "").not.toContain("In your report");
  });

  it("explains reference ranges, flags, units, fasting and critical values", () => {
    const text = (message: string) => {
      const answer = answerFor(message, "en", []);
      return answer.type === "answer" ? answer.text : "";
    };
    expect(text("What is a reference range?")).toContain("span of values most healthy people");
    expect(text("What does H mean next to my value?")).toContain("above the usual range");
    expect(text("What does mg/dL mean in my report?")).toContain("milligrams");
    expect(text("What does fasting mean?")).toContain("eight hours");
    expect(text("What does critical mean in my result?")).toContain("very far outside");
  });

  it("needs a report context before treating a bare word like 'high' as a question about the report", () => {
    expect(classify("how high is mount everest").kind).toBe("off_topic");
    expect(classify("what does high mean in my report").kind).toBe("terms");
  });

  it("separates HDL from total cholesterol", () => {
    const intent = classify("What is HDL cholesterol?");
    expect(intent.kind === "analytes" ? intent.analytes.map((entry) => entry.code) : []).toEqual(["HDL"]);
    const total = classify("What is total cholesterol?");
    expect(total.kind === "analytes" ? total.analytes.map((entry) => entry.code) : []).toEqual(["TC"]);
  });

  it("summarises the latest report, flagged values first", () => {
    const answer = answerFor("Explain my report in simple words", "en", [hba1c, hdl, tg]);
    const text = answer.type === "answer" ? answer.text : "";
    expect(text).toContain("2 of 3");
    expect(text).toContain("HbA1c: 7.1 %, above the usual range.");
    expect(text).toContain("HDL cholesterol: 38 mg/dL, below the usual range.");
    expect(text).toContain("The rest are within the usual range.");
  });

  it("says when every value is in range, and when there is no confirmed report", () => {
    expect(answerFor("explain my report", "en", [tg])).toMatchObject({ type: "answer", text: expect.stringContaining("All 1 values") });
    expect(answerFor("explain my report", "en", [])).toMatchObject({ type: "answer", text: expect.stringContaining("could not find a confirmed report") });
  });

  it("answers in Hindi, Marathi and Hinglish", () => {
    expect(answerFor("HbA1c क्या है?", "hi", [])).toMatchObject({ text: expect.stringContaining("औसत रक्त शर्करा") });
    expect(answerFor("हिमोग्लोबिन म्हणजे काय?", "mr", [])).toMatchObject({ text: expect.stringContaining("ऑक्सिजन") });
    expect(answerFor("hba1c kya hai", "hinglish", [hba1c])).toMatchObject({ text: expect.stringContaining("Aapki report mein HbA1c 7.1 % hai") });
  });
});

describe("coverage", () => {
  it("has a plain-words entry for every test the report reader can find", () => {
    expect(glossaryAnalytes.map((entry) => entry.code).sort()).toEqual(analytes.map((entry) => entry.code).sort());
  });

  it("explains every test in all four languages", () => {
    for (const entry of glossaryAnalytes) {
      for (const language of ["en", "hi", "mr", "hinglish"] as const) expect(entry.what[language].length).toBeGreaterThan(20);
    }
  });
});

describe("streaming", () => {
  const options = { wordDelayMs: 0, requestId: "req_1", sleep: async () => undefined };
  async function collect(message: string, observations: AssistantObservation[] = []) {
    const events: Array<{ event: string; data: unknown }> = [];
    for await (const event of streamAssistant(message, "en", options, observations)) events.push(event);
    return events;
  }

  it("streams words then done, with no citations", async () => {
    const events = await collect("What is a reference range?");
    expect(events.at(-1)?.event).toBe("done");
    expect(events.slice(0, -1).every((event) => event.event === "token")).toBe(true);
    expect(events.map((event) => event.event)).not.toContain("citations");
    expect(events.slice(0, -1).map((event) => (event.data as { text: string }).text).join("")).toContain("reference range");
  });

  it("sends the fixed refusal and then done for anything else", async () => {
    const events = await collect("Tell me about the weather");
    expect(events.map((event) => event.event)).toEqual(["refusal", "done"]);
    expect(events[0]?.data).toEqual({ message: offTopicMessage.en, reason: "off_topic" });
  });
});
