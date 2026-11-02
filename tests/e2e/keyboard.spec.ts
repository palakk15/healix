import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoSeriousViolations, marathi, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function tabTo(page: Page, target: Locator, limit = 60): Promise<void> {
  const handle = await target.elementHandle();
  if (!handle) throw new Error("tab target is not on the page");
  for (let step = 0; step < limit; step += 1) {
    if (await handle.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("could not reach the target with Tab");
}

test("triage to booking works with the keyboard alone, with a visible focus ring", async ({ page }) => {
  await startDemo(page);
  await page.locator('nav a[href="/app/triage"]').focus();
  await page.keyboard.press("Enter");

  const box = page.getByRole("textbox", { name: "Describe your symptoms" });
  await tabTo(page, box);
  await page.keyboard.type("Do din se pet mein jalan ho rahi hai");

  const send = page.getByRole("button", { name: "Send", exact: true });
  await tabTo(page, send);
  const ring = await send.evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");

  const doctors = page.getByRole("link", { name: "Show doctors near me" });
  await expect(doctors).toBeVisible();
  await tabTo(page, doctors);
  await page.keyboard.press("Enter");

  const book = page.getByRole("button", { name: "Book top pick" });
  await expect(book).toBeVisible();
  await tabTo(page, book);
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Confirm booking" });
  await tabTo(page, confirm);
  await page.keyboard.press("Enter");

  const taken = page.getByRole("alert").filter({ hasText: "Just taken" }).getByRole("button");
  await expect(taken).toBeVisible();
  await tabTo(page, taken);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ticket-number")).toBeVisible();
});

test("Escape closes the booking dialog and returns focus to the button that opened it", async ({ page }) => {
  await startDemo(page);
  await page.locator('nav a[href="/app/triage"]').click();
  await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("link", { name: "Show doctors near me" }).click();
  const book = page.getByRole("button", { name: "Book top pick" });
  await book.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(book).toBeFocused();
});

test.describe("accessibility sweep in Marathi with large text on", () => {
  const routes = ["/app", "/app/triage", "/app/doctors?specialty=Gastroenterology&urgency=soon", "/app/reports", "/app/reports/upload", "/app/assistant", "/app/settings", "/app/emergency"];

  test("every patient screen has no serious violations", async ({ page }) => {
    await startDemo(page, marathi);
    await page.goto("/app/settings?fast=1");
    await page.getByRole("switch", { name: "मोठे अक्षर आणि सोपे स्क्रीन" }).click();
    for (const route of routes) {
      await page.goto(`${route}${route.includes("?") ? "&" : "?"}fast=1`);
      await expect(page.locator("main#main").first()).toBeVisible();
      await page.waitForTimeout(400);
      await expectNoSeriousViolations(page);
    }
  });
});

test("every screen sets its own page title, in the chosen language", async ({ page }) => {
  await startDemo(page);
  await expect(page).toHaveTitle("Home · Healix");
  await page.locator('nav a[href="/app/reports"]').click();
  await expect(page).toHaveTitle("My reports · Healix");
  await page.locator('nav a[href="/app/assistant"]').click();
  await expect(page).toHaveTitle("Healix AI · Healix");
  await page.goto("/app/settings?fast=1");
  await expect(page).toHaveTitle("Settings · Healix");
  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "मराठी" }).click();
  await expect(page).toHaveTitle("सेटिंग्ज · Healix");
});
