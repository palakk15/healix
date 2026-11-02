import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, marathi, onboard, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

const fixed = "I can only answer doubts related to the report.";

async function openAssistant(page: Page) {
  await page.locator('nav a[href="/app/assistant"]').click();
  await expect(page.getByRole("heading", { name: "Healix AI", level: 1 })).toBeVisible();
}

async function ask(page: Page, question: string) {
  await page.getByLabel("Your question", { exact: true }).fill(question);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

test.describe("report assistant (guardrailed)", () => {
  test("introduces itself, says hello back, and still declines medicine and unrelated questions", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await expect(page.getByText("I cannot diagnose or suggest medicines.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "What does HbA1c mean?" })).toBeVisible();
    await ask(page, "hi");
    await expect(page.getByTestId("answer").last()).toContainText("I am Healix AI");
    await expect(page.getByTestId("refusal")).toHaveCount(0);
    await ask(page, "Who won the cricket match?");
    await expect(page.getByTestId("refusal").last()).toHaveText(fixed);
    await expect(page).toHaveTitle("Healix AI · Healix");
  });

  test("explains a term from the report in plain words, with the patient's own value", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await ask(page, "What does HbA1c mean?");
    const answer = page.getByTestId("answer").last();
    await expect(answer).toContainText("average blood sugar over the last two to three months");
    await expect(answer).toContainText("In your report, HbA1c is 7.9");
    await expect(answer).toContainText("above the usual range");
    await expect(answer.getByText(/not a diagnosis/i)).toBeVisible();
    await expect(page.getByRole("log")).toHaveAttribute("aria-live", "polite");
  });

  test("explains reference ranges, flags and the whole report", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await page.getByRole("button", { name: "What is a reference range?" }).click();
    await expect(page.getByTestId("answer").last()).toContainText("span of values most healthy people have");
    await ask(page, "What does H mean next to my value?");
    await expect(page.getByTestId("answer").last()).toContainText("above the usual range");
    await ask(page, "Explain my report in simple words");
    const summary = page.getByTestId("answer").last();
    await expect(summary).toContainText("outside the usual range");
    await expect(summary).toContainText("HbA1c");
  });

  test("answers anything else with the one fixed sentence and nothing more", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    for (const question of ["Who won the cricket match yesterday?", "How many metformin tablets should I take?", "I have a headache, what should I do?"]) {
      await ask(page, question);
      const refusal = page.getByTestId("refusal").last();
      await expect(refusal).toHaveText(fixed);
      await expect(refusal).toHaveAttribute("data-reason", "off_topic");
    }
    await expect(page.getByTestId("answer")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Consult a doctor" })).toHaveCount(0);
  });

  test("admits when a report word is not in its glossary instead of guessing", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await ask(page, "What does ferritin mean in my report?");
    await expect(page.getByTestId("refusal").last()).toContainText("I do not have that term in my glossary yet");
  });

  test("the conversation keeps its order and never shows source chips", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await page.getByRole("button", { name: "What does HbA1c mean?" }).click();
    await expect(page.getByTestId("answer").first()).toBeVisible();
    await ask(page, "Tell me a joke");
    await expect(page.getByTestId("question")).toHaveCount(2);
    await expect(page.getByTestId("refusal")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open source/ })).toHaveCount(0);
  });

  test("a new person with no report gets an honest answer about what is missing", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/settings?fast=1");
    await page.getByRole("button", { name: "Add a family member" }).click();
    await page.getByRole("dialog").getByLabel("Full name").fill("Anaya Patil");
    await page.getByRole("dialog").getByLabel("Age", { exact: true }).fill("9");
    await page.getByRole("dialog").getByRole("button", { name: "Add member" }).click();
    await page.goto("/app/assistant?fast=1");
    await ask(page, "What does fasting mean?");
    await expect(page.getByTestId("answer").last()).toContainText("eight hours");
  });

  test("answers in the patient's language", async ({ page }) => {
    await page.goto("/?fast=1&lang=mr");
    await page.getByRole("main").getByRole("link", { name: /डेमो वापरून पहा/ }).click();
    await onboard(page, marathi);
    await page.locator('nav a[href="/app/assistant"]').click();
    await page.getByRole("button", { name: "HbA1c म्हणजे काय?" }).click();
    await expect(page.getByTestId("answer").first()).toContainText("तीन महिन्यांची");
    await page.getByLabel("तुमचा प्रश्न", { exact: true }).fill("आज पाऊस पडेल का?");
    await page.getByRole("button", { name: "पाठवा", exact: true }).click();
    await expect(page.getByTestId("refusal").last()).toHaveText("मी फक्त अहवालाशी संबंधित शंकांची उत्तरे देऊ शकतो.");
  });

  test("the explain screen links to the assistant", async ({ page }) => {
    await startDemo(page);
    await page.locator('nav a[href="/app/reports"]').click();
    await page.getByRole("link", { name: /Diabetes check-up/ }).first().click();
    await page.getByRole("link", { name: "Ask Healix AI about a word in this report" }).click();
    await expect(page.getByRole("heading", { name: "Healix AI", level: 1 })).toBeVisible();
  });
});

test.describe("accessibility and layout", () => {
  test("empty, answered and refused states have no serious violations", async ({ page }) => {
    await startDemo(page);
    await openAssistant(page);
    await expectNoSeriousViolations(page);
    await ask(page, "What does HbA1c mean?");
    await expect(page.getByTestId("answer").last()).toContainText("average blood sugar");
    await expectNoSeriousViolations(page);
    await ask(page, "Who won the cricket match?");
    await expect(page.getByTestId("refusal")).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?fast=1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Try the demo" }).click();
    await onboard(page);
    await page.locator('nav a[href="/app/assistant"]').click();
    await ask(page, "What does HbA1c mean?");
    await expect(page.getByTestId("answer").last()).toContainText("average blood sugar");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
