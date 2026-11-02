import AxeBuilder from "@axe-core/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function resetWorld(request: APIRequestContext): Promise<void> {
  const login = await request.post("/api/auth/login", { data: { phone: "9000000001", otp: "123456" } });
  const { access_token: token } = (await login.json()) as { access_token: string };
  await request.post("/api/mock/simulator/reset", { headers: { authorization: `Bearer ${token}` } });
}

export interface StepLabels {
  language: string;
  cont: string;
  demo: string;
  confirm: string;
  consents: [string, string, string, string];
  finish: string;
}

export const english: StepLabels = {
  language: "English",
  cont: "Continue",
  demo: "Use the demo account",
  confirm: "Confirm",
  consents: ["Understand my symptoms", "Read my reports", "Use my location", "Listen and speak"],
  finish: "Start using Healix",
};

export const marathi: StepLabels = {
  language: "मराठी",
  cont: "पुढे जा",
  demo: "डेमो खाते वापरा",
  confirm: "निश्चित करा",
  consents: ["माझी लक्षणे समजून घेणे", "माझे अहवाल वाचणे", "माझे ठिकाण वापरणे", "ऐकणे आणि बोलणे"],
  finish: "Healix वापरायला सुरू करा",
};

export const hindi: StepLabels = {
  language: "हिन्दी",
  cont: "आगे बढ़ें",
  demo: "डेमो खाता इस्तेमाल करें",
  confirm: "पक्का करें",
  consents: ["मेरे लक्षण समझना", "मेरी रिपोर्ट पढ़ना", "मेरी लोकेशन इस्तेमाल करना", "सुनना और बोलना"],
  finish: "Healix इस्तेमाल करना शुरू करें",
};

export async function onboard(page: Page, labels: StepLabels = english, options: { consents?: number[] } = {}): Promise<void> {
  await page.getByRole("radio", { name: labels.language }).click();
  await page.getByRole("button", { name: labels.cont }).click();
  await page.getByRole("button", { name: labels.demo }).click();
  await page.getByRole("button", { name: labels.confirm }).click();
  for (const index of options.consents ?? [0, 1, 2, 3]) {
    await page.getByRole("switch", { name: labels.consents[index] ?? "" }).click();
  }
  await page.getByRole("button", { name: labels.cont }).click();
  await page.getByRole("button", { name: labels.finish }).click();
}

export async function expectNoSeriousViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

export async function holdPointer(page: Page, locator: ReturnType<Page["getByTestId"]>, ms: number): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("hold target is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

export async function goToSymptoms(page: Page): Promise<void> {
  await page.locator('nav a[href="/app/triage"]').click();
}

export async function startDemo(page: Page, labels: StepLabels = english): Promise<void> {
  await page.goto("/?fast=1");
  await page.getByRole("link", { name: /Try the demo|डेमो वापरून पहा/ }).first().click();
  await onboard(page, labels);
}

export async function reachDoctors(page: Page, text = "Do din se pet mein jalan ho rahi hai"): Promise<void> {
  await goToSymptoms(page);
  await page.getByRole("textbox", { name: "Describe your symptoms" }).fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("link", { name: "Show doctors near me" }).click();
  await page.getByRole("article", { name: "Dr. Meera Kulkarni" }).waitFor();
}

export async function bookTopPick(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Book top pick" }).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await page.getByRole("alert").filter({ hasText: "Just taken" }).getByRole("button").click();
  await page.getByTestId("ticket-number").waitFor();
}

export async function staffToken(request: APIRequestContext): Promise<string> {
  const login = await request.post("/api/auth/login", { data: { phone: "9000000001", otp: "123456" } });
  return ((await login.json()) as { access_token: string }).access_token;
}
