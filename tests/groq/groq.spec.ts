import { expect, test, type Page } from "@playwright/test";
import { english } from "../e2e/helpers";

const sample = "server/mock/data/reports/diabetes-panel.png";

async function register(page: Page, phone: string) {
  await page.goto("/app/welcome");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("424242");
  await page.getByRole("button", { name: "Confirm" }).click();
  for (const label of english.consents) await page.getByRole("switch", { name: label }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await page.getByRole("button", { name: english.finish }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("the server reports Groq, and answers from an uploaded report arrive from Groq over real HTTP", async ({ page, request }) => {
  expect(((await (await request.get("/api/meta")).json()) as { assistant_mode: string }).assistant_mode).toBe("groq");
  await register(page, "9811100011");
  await page.goto("/app/reports/upload");
  await page.getByTestId("report-file").setInputFiles(sample);
  await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Confirm values" }).click();
  await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();

  await page.locator('nav a[href="/app/assistant"]').click();
  await page.getByLabel("Your question").fill("Is my HbA1c high?");
  await page.getByRole("button", { name: "Send" }).click();
  const answer = page.getByTestId("answer").last();
  await expect(answer).toContainText("FAKE-GROQ saw the report", { timeout: 20_000 });
  await expect(answer.getByTestId("answer-source")).toHaveText("Answered with Groq");
  await expect(answer.getByRole("button", { name: /source 1/i })).toBeVisible();

  await page.getByLabel("Your question").fill("Who won the cricket match?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("refusal").last()).toHaveAttribute("data-reason", "off_topic");
});
