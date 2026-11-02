import { expect, test } from "@playwright/test";
import { bookTopPick, goToSymptoms, marathi, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test("the full demo script, from the first Marathi phrase to the hospital dashboard", async ({ page, context }) => {
  test.setTimeout(170_000);

  await startDemo(page, marathi);
  await goToSymptoms(page);
  await page.getByRole("button", { name: "बोलून सांगा" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "रेकॉर्डिंग थांबवा" }).click();
  await expect(page.getByRole("textbox", { name: "तुमची लक्षणे सांगा" })).toHaveValue("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून");
  await page.getByRole("button", { name: "पाठवा" }).click();
  await expect(page.locator('[data-urgency="soon"]')).toBeVisible();
  await expect(page.getByRole("list").filter({ has: page.locator("[aria-live=polite]") }).or(page.locator("ol[aria-live=polite]")).first()).toBeVisible();

  await page.goto("/app/settings?fast=1");
  await page.getByRole("group", { name: "भाषा" }).getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();

  await goToSymptoms(page);
  await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("link", { name: "Show doctors near me" }).click();
  const top = page.getByRole("article", { name: "Dr. Meera Kulkarni" });
  await expect(top.getByText("Speaks English · 2.1 km · About 25 min")).toBeVisible();
  await expect(top.getByText("Estimate", { exact: true })).toBeVisible();
  await bookTopPick(page);

  await expect(page.getByTestId("ticket-number")).toHaveText("A-23");
  await expect(page.getByRole("heading", { name: /Leave home in \d+ min/ })).toBeVisible();
  await expect(page.getByText("Why this estimate")).toBeVisible();
  await expect(page.getByTestId("sheet")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("sheet").getByRole("button", { name: "Accept" }).click();
  await expect(page.getByTestId("ticket-number")).toHaveText("A-24");

  await page.locator('nav a[href="/app/reports"]').click();
  await page.getByRole("link", { name: "Upload", exact: true }).click();
  await page.getByTestId("report-file").setInputFiles("server/mock/data/reports/diabetes-panel.png");
  await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("row-FBS")).toHaveAttribute("data-attention", "true");
  await page.getByLabel("Fasting glucose").fill("132");
  await page.getByRole("button", { name: "Confirm values" }).click();
  await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
  await expect(page.getByRole("article", { name: "HbA1c" }).getByText("Earlier 7.9, now 7.1 %")).toBeVisible();
  await expect(page.getByRole("article", { name: "Total cholesterol" }).getByRole("note")).toContainText("You had this test 20 days ago");
  await expect(page.getByTestId("parchi")).toBeVisible();

  await page.locator('nav a[href="/app/assistant"]').click();
  await page.getByLabel("Your question", { exact: true }).fill("What does HbA1c mean?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("answer").last()).toContainText("In your report, HbA1c is 7.1");
  await page.getByLabel("Your question", { exact: true }).fill("How many metformin tablets should I take?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("refusal")).toHaveText("I can only answer doubts related to the report.");

  await goToSymptoms(page);
  await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("chest pain and sweating");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByTestId("emergency-screen")).toBeVisible();
  await expect(page.getByRole("link", { name: /Call 102/ })).toBeVisible();

  const staff = await context.newPage();
  await staff.goto("/?fast=1");
  await staff.getByRole("button", { name: "See the dashboard" }).click();
  await staff.getByRole("navigation").getByRole("link", { name: "Live queues", exact: true }).click();
  await expect(staff.locator('tr[data-testid^="queue-"]').first()).toBeVisible();
  await staff.getByRole("navigation").getByRole("link", { name: "Queue simulator", exact: true }).click();
  await staff.getByRole("button", { name: "Replay a day in 2 minutes" }).click();
  await expect.poll(async () => Number((await staff.getByTestId("sim-percent").textContent())?.match(/\d+/)?.[0] ?? 0), { timeout: 20_000 }).toBeGreaterThan(40);
  await staff.getByRole("navigation").getByRole("link", { name: "Booking modes", exact: true }).click();
  await expect(staff.locator('[data-mode="pessimistic"]').first()).toBeVisible({ timeout: 30_000 });
  await staff.getByRole("navigation").getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(staff.getByTestId("mae-model")).toHaveText("3.9 min");
  await expect(staff.getByTestId("mae-simple")).toHaveText("9.0 min");
});
