import { expect, test, type Browser, type Page } from "@playwright/test";
import { english, expectNoSeriousViolations } from "../e2e/helpers";

const code = "424242";
const sample = "server/mock/data/reports/diabetes-panel.png";
let counter = 0;
const nextPhone = () => `98${String(Date.now()).slice(-6)}${String((counter += 1)).padStart(2, "0")}`;

async function registerThroughTheApp(page: Page, phone: string) {
  await page.goto("/app/welcome");
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("No text message is sent in this setup.")).toBeVisible();
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();
  for (const label of english.consents) await page.getByRole("switch", { name: label }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await page.getByRole("button", { name: english.finish }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function staffPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/hospital");
  await expect(page).toHaveURL(/\/hospital\/login$/);
  await page.getByLabel("Staff phone number").fill("9000000001");
  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
  return page;
}

test.describe("local mode, a real backend", () => {
  test("reports itself as local and shows no demo shortcuts", async ({ page, request }) => {
    expect(((await (await request.get("/api/meta")).json()) as { data_mode: string }).data_mode).toBe("local");
    await page.goto("/app/welcome");
    await page.getByRole("radio", { name: "English" }).click();
    await page.getByRole("button", { name: english.cont }).click();
    await expect(page.getByRole("button", { name: "Use the demo account" })).toHaveCount(0);
  });

  test("a new person signs up with the code, and the wrong code is refused", async ({ page }) => {
    const phone = nextPhone();
    await page.goto("/app/welcome");
    await page.getByRole("radio", { name: "English" }).click();
    await page.getByRole("button", { name: english.cont }).click();
    await page.getByLabel("Mobile number").fill(phone);
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("alert")).toContainText("That code is not correct");
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("switch", { name: "Read my reports" })).toBeVisible();
  });

  test("the hospital area asks staff to sign in, and refuses a patient number", async ({ page, browser }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "See the dashboard" }).click();
    await expect(page).toHaveURL(/\/hospital\/login$/);
    await page.getByLabel("Staff phone number").fill("9812345600");
    await page.getByLabel("Sign-in code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    const staff = await staffPage(browser);
    await expect(staff.getByRole("navigation").getByRole("link", { name: "Queue simulator" })).toHaveCount(0);
    await staff.getByRole("navigation").getByRole("link", { name: "Live queues", exact: true }).click();
    const rows = staff.locator('tr[data-testid^="queue-"]');
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.locator("td:nth-child(3)").allTextContents()) expect(text.trim()).toBe("0");
    await staff.context().close();
  });

  test("a real photo of a report is read, checked, confirmed and explained", async ({ page }) => {
    await registerThroughTheApp(page, nextPhone());
    await page.locator('nav a[href="/app/reports"]').click();
    await expect(page.getByText("No reports yet")).toBeVisible();
    await page.getByRole("link", { name: "Upload a report" }).click();
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 45_000 });

    await expect(page.getByLabel("HbA1c")).toHaveValue("7.1");
    await expect(page.getByTestId("row-HBA1C")).toHaveAttribute("data-attention", "true");
    await expect(page.getByLabel("Fasting glucose")).toHaveValue("132");
    await expect(page.getByTestId("row-FBS")).toHaveAttribute("data-attention", "false");
    await expect(page.getByTestId("marker-HBA1C")).toBeVisible();

    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
    await expect(page.getByRole("article", { name: "HbA1c" }).getByText("Above the usual range", { exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: "Fasting glucose" })).toBeVisible();
    await expect(page.getByRole("article", { name: "HbA1c" }).getByTestId("sparkline")).toHaveCount(0);
    await expect(page.getByTestId("normal-line")).toContainText("Triglycerides");
    await expect(page.getByTestId("parchi").getByRole("listitem")).toHaveCount(3);
    await expectNoSeriousViolations(page);

    await page.locator('nav a[href="/app/reports"]').click();
    await expect(page.getByRole("list", { name: "My reports" }).getByRole("listitem")).toHaveCount(1);
  });

  test("the assistant answers from the report that was just uploaded, with a source, and refuses other topics", async ({ page }) => {
    await registerThroughTheApp(page, nextPhone());
    await page.locator('nav a[href="/app/assistant"]').click();
    await page.getByLabel("Your question").fill("What does HbA1c mean?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("answer").last()).toContainText("HbA1c", { timeout: 20_000 });
    await expect(page.getByTestId("refusal")).toHaveCount(0);

    await page.goto("/app/reports/upload");
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();

    await page.locator('nav a[href="/app/assistant"]').click();
    await page.getByLabel("Your question").fill("What does the Pune Central Diagnostics page say about the sample layout?");
    await page.getByRole("button", { name: "Send" }).click();
    const answer = page.getByTestId("answer").last();
    await expect(answer).toContainText("Pune Central Diagnostics", { timeout: 20_000 });
    await answer.getByRole("button", { name: /source 1/i }).click();
    await expect(page.getByRole("dialog")).toContainText("Report excerpt");
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.getByLabel("Your question").fill("Who won the cricket match?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("refusal").last()).toHaveAttribute("data-reason", "off_topic");
  });

  test("any document is accepted: a text file with no lab values is kept, can be confirmed, and the chatbot greets and answers from it", async ({ page }) => {
    await registerThroughTheApp(page, nextPhone());
    await page.goto("/app/reports/upload");
    await expect(page.getByText("up to 50 MB")).toBeVisible();
    await page.getByTestId("report-file").setInputFiles({
      name: "discharge.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Discharge summary. The patient was admitted for observation and discharged in stable condition after two days."),
    });
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("no-values")).toBeVisible();
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByText(/This document is saved/)).toBeVisible();

    await page.locator('nav a[href="/app/assistant"]').click();
    await page.getByLabel("Your question").fill("hi");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("answer").last()).toContainText("Healix AI", { timeout: 20_000 });
    await expect(page.getByTestId("refusal")).toHaveCount(0);
    await page.getByLabel("Your question").fill("What does the discharge summary say about observation?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("answer").last()).toContainText("discharged", { timeout: 20_000 });
  });

  test("a file that is not a report is turned away kindly", async ({ page }) => {
    await registerThroughTheApp(page, nextPhone());
    await page.goto("/app/reports/upload");
    await page.getByTestId("report-file").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("this is not really an image") });
    await expect(page.getByRole("alert")).toContainText("We could not open this file", { timeout: 45_000 });
  });

  test("a patient books, and the front desk calls them from the dashboard", async ({ page, browser }) => {
    await registerThroughTheApp(page, nextPhone());
    await page.locator('nav a[href="/app/triage"]').click();
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByRole("link", { name: "Show doctors near me" }).click();
    const top = page.getByRole("article").first();
    await expect(top).toBeVisible();
    const doctorName = (await top.getAttribute("aria-label")) ?? "";
    await top.getByRole("button", { name: "Book top pick" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Confirm booking" });
    const hasSlot = await confirm.isEnabled({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasSlot, "The top doctor has no free time in the next two days, so there is nothing to book.");

    await confirm.click();
    await expect(page.getByRole("alert").filter({ hasText: "Just taken" })).toHaveCount(0);
    await expect(page.getByTestId("ticket-number")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/0 ahead|Your turn/).first()).toBeVisible();

    const staff = await staffPage(browser);
    await staff.getByRole("navigation").getByRole("link", { name: "Live queues", exact: true }).click();
    const row = staff.locator('tr[data-testid^="queue-"]').filter({ hasText: doctorName });
    await expect(row.locator("td").nth(1)).toHaveText("1");
    await row.getByRole("button", { name: /Call next patient for/ }).click();
    await expect(page.getByText(/It is your turn/)).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: /Complete current patient for/ }).click();
    await expect(page.getByText(/This visit is finished/)).toBeVisible({ timeout: 20_000 });
    await staff.context().close();
  });
});
