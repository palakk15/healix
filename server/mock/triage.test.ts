import { describe, expect, it } from "vitest";
import { triageResponseSchema } from "@core/api/schemas/ai";
import { answerTriage, detectLanguage, runTriage } from "./triage";

function triage(text: string, extra: { age?: number; language?: string } = {}) {
  return runTriage({ text, age: extra.age ?? 40, sex: "female", language: extra.language }, "sess_test");
}

describe("scripted demo phrases", () => {
  const cases: Array<[string, string, string, boolean]> = [
    ["जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून", "Gastroenterology", "soon", false],
    ["Do din se pet mein jalan ho rahi hai", "Gastroenterology", "soon", false],
    ["मुझे दो दिन से सिर में बहुत दर्द है", "General Physician", "soon", false],
    ["Knee pain when climbing stairs for 2 weeks", "Orthopedics", "routine", false],
    ["chest pain and sweating", "Cardiology", "emergency", true],
    ["बच्चे को तेज बुखार है, 2 महीने का है", "Pediatrics", "emergency", true],
  ];

  it.each(cases)("%s", (text, specialty, urgency, flagged) => {
    const { response } = triage(text);
    expect(response.specialty).toBe(specialty);
    expect(response.urgency).toBe(urgency);
    expect(response.red_flags.length > 0).toBe(flagged);
    expect(response.reasoning).toHaveLength(3);
    expect(triageResponseSchema.safeParse({ ...response, request_id: "r", model: "m", prompt_version: "v" }).success).toBe(true);
  });

  it("answers the demo phrases in the language they were written in", () => {
    expect(triage("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून").response.language).toBe("mr");
    expect(triage("Do din se pet mein jalan ho rahi hai").response.language).toBe("hinglish");
    expect(triage("Knee pain when climbing stairs for 2 weeks").response.language).toBe("en");
  });

  it("gives the headache phrase exactly one follow-up question", () => {
    expect(triage("मुझे दो दिन से सिर में बहुत दर्द है").response.follow_up_questions).toHaveLength(1);
  });
});

describe("red flags", () => {
  const flagged: Array<[string, string]> = [
    ["I have chest pain and I am sweating a lot", "chest pain with sweating"],
    ["सीने में दर्द है और पसीना आ रहा है", "chest pain with sweating (hi)"],
    ["छातीत दुखतंय आणि घाम येतोय", "chest pain with sweating (mr)"],
    ["seene mein dard aur pasina aa raha hai", "chest pain with sweating (hinglish)"],
    ["I am struggling to breathe", "breathing"],
    ["it is hard to breathe", "breathing (hard to)"],
    ["difficulty in breathing since morning", "breathing (difficulty in)"],
    ["I can't breathe", "breathing (can't)"],
    ["मुझे साँस लेने में तकलीफ है", "breathing (hi)"],
    ["my father's face is drooping on one side", "face drooping"],
    ["sudden severe headache like never before", "sudden headache"],
    ["अचानक बहुत तेज सिरदर्द हुआ", "sudden headache (hi)"],
    ["there is heavy bleeding that won't stop", "heavy bleeding"],
    ["he is having a seizure", "fits"],
    ["she fainted and is unconscious", "fainting"],
    ["my newborn baby has a fever", "baby fever"],
    ["I am pregnant and there is bleeding", "pregnancy bleeding"],
    ["गर्भवती हूँ और खून आ रहा है", "pregnancy bleeding (hi)"],
    ["he swallowed pesticide", "poisoning"],
    ["मैंने ज़हर खा लिया", "poisoning (hi)"],
    ["I want to kill myself", "self-harm"],
    ["मला जीव द्यावासा वाटतो, मरावेसे वाटते", "self-harm (mr)"],
  ];

  it.each(flagged)("%s → emergency (%s)", (text) => {
    const { response } = triage(text);
    expect(response.urgency).toBe("emergency");
    expect(response.red_flags.length).toBeGreaterThan(0);
  });

  it("does not raise an emergency for a calm fever in an adult or a 2-year-old", () => {
    expect(triage("I have had a fever for one day").response.urgency).not.toBe("emergency");
    expect(triage("my 2 year old baby has a mild fever", { age: 2 }).response.urgency).not.toBe("emergency");
  });

  it("does not treat the plain headache phrase as a red flag", () => {
    expect(triage("I have a headache since yesterday").response.red_flags).toEqual([]);
  });
});

describe("specialty rules", () => {
  const cases: Array<[string, string]> = [
    ["acidity and bloating after meals", "Gastroenterology"],
    ["my heart is racing with palpitations", "Cardiology"],
    ["dry cough and wheezing at night", "Pulmonology"],
    ["frequent migraine with dizziness", "Neurology"],
    ["lower back pain for a month", "Orthopedics"],
    ["itchy rash on my arms", "Dermatology"],
    ["sore throat and blocked nose", "ENT"],
    ["blurry vision in the left eye", "Ophthalmology"],
    ["my periods are irregular", "Gynecology and Obstetrics"],
    ["I feel anxious and cannot sleep", "Psychiatry"],
    ["burning while passing urine", "Urology"],
    ["my thyroid levels are off", "Endocrinology"],
    ["toothache for two days", "Dentistry"],
    ["feeling weak and tired", "General Physician"],
  ];

  it.each(cases)("%s → %s", (text, specialty) => {
    expect(triage(text).response.specialty).toBe(specialty);
  });

  it("covers Hindi, Marathi and Hinglish phrasing", () => {
    expect(triage("मेरे दाँत में दर्द है").response.specialty).toBe("Dentistry");
    expect(triage("मला गुडघे दुखतात").response.specialty).toBe("Orthopedics");
    expect(triage("mujhe khansi aur saans ki dikkat hai").response.specialty).toBe("Pulmonology");
  });

  it("routes children to a pediatrician", () => {
    expect(triage("he has a cough", { age: 6 }).response.specialty).toBe("Pediatrics");
  });

  it("escalates blood in stool to urgent", () => {
    expect(triage("there is blood in stool since morning").response.urgency).toBe("urgent");
  });
});

describe("language detection", () => {
  it("separates Marathi, Hindi, Hinglish and English", () => {
    expect(detectLanguage("मला पोटात दुखत आहे")).toBe("mr");
    expect(detectLanguage("मेरे पेट में दर्द है")).toBe("hi");
    expect(detectLanguage("mujhe pet mein dard hai")).toBe("hinglish");
    expect(detectLanguage("I have a stomach ache")).toBe("en");
  });
});

describe("follow-up round", () => {
  it("escalates to an emergency when the sudden-headache answer is yes", () => {
    const first = triage("मुझे दो दिन से सिर में बहुत दर्द है");
    const yes = first.session.pendingYesAnswer ?? "";
    const result = answerTriage(first.session, [{ question: first.session.pendingQuestion ?? "", answer: yes }]);
    expect(result.urgency).toBe("emergency");
    expect(result.red_flags.length).toBeGreaterThan(0);
  });

  it("settles on a general physician when the answer is no, with no more questions", () => {
    const first = triage("मुझे दो दिन से सिर में बहुत दर्द है");
    const result = answerTriage(first.session, [{ question: first.session.pendingQuestion ?? "", answer: "नहीं, धीरे-धीरे बढ़ा" }]);
    expect(result.urgency).toBe("soon");
    expect(result.specialty).toBe("General Physician");
    expect(result.follow_up_questions).toEqual([]);
  });
});
