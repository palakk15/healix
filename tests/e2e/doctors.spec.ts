import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function openFinder(page: Page) {
  await startDemo(page);
  await page.getByRole("link", { name: /Find a doctor/ }).first().click();
  await expect(page.getByRole("heading", { name: "Doctors near you", level: 1 })).toBeVisible();
}

test.describe("find a doctor", () => {
  test("starts with a booking form: a specialty dropdown, a date, a preferred time and a purpose", async ({ page }) => {
    await openFinder(page);
    const form = page.getByRole("region", { name: "Booking details" });
    const specialty = form.getByLabel("Specialty");
    await expect(specialty).toHaveJSProperty("tagName", "SELECT");
    expect(await specialty.locator("option").count()).toBe(17);
    await expect(form.getByLabel("Date")).toHaveAttribute("type", "date");
    await expect(form.getByLabel("Preferred time").locator("option")).toHaveText(["Any time", "Morning", "Afternoon", "Evening"]);
    await expect(form.getByLabel("Purpose of visit").locator("option")).toHaveText(["New problem", "Follow-up visit", "Discuss a report", "Routine check-up", "Second opinion"]);
    await expect(page.getByRole("button", { name: "Gastroenterology" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Doctors for your search" })).toHaveCount(0);
  });

  test("asks for a specialty before searching", async ({ page }) => {
    await openFinder(page);
    await page.getByRole("button", { name: "Find doctors" }).click();
    await expect(page.getByRole("alert")).toHaveText("Please choose a specialty.");
    await expect(page.getByLabel("Specialty")).toHaveAttribute("aria-invalid", "true");
  });

  test("shows the doctors for the chosen specialty after the form, with filters", async ({ page }) => {
    await openFinder(page);
    await page.getByLabel("Specialty").selectOption({ label: "Gastroenterologist" }).catch(async () => page.getByLabel("Specialty").selectOption("Gastroenterology"));
    await page.getByLabel("Preferred time").selectOption("morning");
    await page.getByLabel("Purpose of visit").selectOption("report");
    await page.getByRole("button", { name: "Find doctors" }).click();

    const results = page.getByRole("region", { name: "Doctors for your search" });
    await expect(results).toBeVisible();
    await expect(page.getByTestId("search-summary")).toContainText("Morning · Discuss a report");
    const form = await page.getByRole("region", { name: "Booking details" }).boundingBox();
    const list = await results.boundingBox();
    expect(list!.y).toBeGreaterThan(form!.y + form!.height - 1);
    await expect(page.getByRole("article", { name: "Dr. Meera Kulkarni" })).toBeVisible();
    expect(await page.getByRole("article").count()).toBeGreaterThanOrEqual(2);

    await page.getByText("Filters", { exact: true }).click();
    await page.getByRole("radiogroup", { name: "Fee" }).getByRole("radio", { name: /500/ }).click();
    await expect(page.getByTestId("search-summary")).toBeVisible();
  });

  test("book top pick uses the chosen date and says what it booked and why", async ({ page }) => {
    await openFinder(page);
    await page.getByLabel("Specialty").selectOption("Gastroenterology");
    await page.getByLabel("Purpose of visit").selectOption("followUp");
    await page.getByLabel("Preferred time").selectOption("afternoon");
    await page.getByRole("button", { name: "Find doctors" }).click();
    await page.getByRole("button", { name: "Book top pick" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Purpose: Follow-up visit");
    await expect(dialog.getByRole("button", { name: "Confirm booking" })).toBeEnabled({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Confirm booking" }).click();
    await page.getByRole("alert").filter({ hasText: "Just taken" }).getByRole("button").click();
    await expect(page.getByTestId("ticket-number")).toBeVisible();
    await expect(page.getByRole("region", { name: "Visit details" })).toContainText("Follow-up visit");
  });

  test("see times carries the date and purpose to the booking page", async ({ page }) => {
    await openFinder(page);
    await page.getByLabel("Specialty").selectOption("Gastroenterology");
    await page.getByLabel("Purpose of visit").selectOption("checkup");
    await page.getByRole("button", { name: "Find doctors" }).click();
    const link = page.getByRole("article", { name: "Dr. Meera Kulkarni" }).getByRole("link", { name: "See times" });
    await expect(link).toHaveAttribute("href", /\/app\/doctors\/doc_meera\?date=\d{4}-\d\d-\d\d&time=any&purpose=checkup/);
    await link.click();
    await expect(page.getByText("Purpose: Routine check-up")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(7);
  });

  test("a link from triage opens the results straight away", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/doctors?specialty=Gastroenterology&urgency=soon&fast=1");
    await expect(page.getByRole("article", { name: "Dr. Meera Kulkarni" })).toBeVisible();
    await expect(page.getByLabel("Specialty")).toHaveValue("Gastroenterology");
  });

  test("has no serious violations and no horizontal scroll on a phone", async ({ page }) => {
    await openFinder(page);
    await expectNoSeriousViolations(page);
    await page.getByLabel("Specialty").selectOption("Cardiology");
    await page.getByRole("button", { name: "Find doctors" }).click();
    await expect(page.getByRole("article").first()).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
