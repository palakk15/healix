import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, onboard, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function openSettings(page: Page) {
  await page.goto("/app/settings?fast=1");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
}

test.describe("settings (demo step 8)", () => {
  test("switches the language straight away", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "हिन्दी" }).click();
    await expect(page.getByRole("heading", { name: "सेटिंग्स", level: 1 })).toBeVisible();
    await page.getByRole("group", { name: "भाषा" }).getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });

  test("large text mode really enlarges text, buttons and spacing, and is saved with the person", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    const metrics = () =>
      page.evaluate(() => ({
        root: parseFloat(getComputedStyle(document.documentElement).fontSize),
        body: parseFloat(getComputedStyle(document.querySelector("main p.type-body, main p.type-small") as Element).fontSize),
        button: (document.querySelector("main button") as HTMLElement).getBoundingClientRect().height,
      }));
    const before = await metrics();
    await page.getByRole("switch", { name: "Large text and simple screens" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");
    const after = await metrics();
    expect(after.root).toBeGreaterThan(before.root * 1.2);
    expect(after.body).toBeGreaterThan(before.body * 1.2);
    expect(after.button).toBeGreaterThan(before.button * 1.15);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");
    await expect(page.getByRole("switch", { name: "Large text and simple screens" })).toHaveAttribute("aria-checked", "true");
  });

  test("large text mode simplifies the home screen and is the only thing remembered besides the language", async ({ page }) => {
    await startDemo(page);
    await expect(page.getByRole("link", { name: /Find a doctor/ }).first()).toBeVisible();
    await openSettings(page);
    await page.getByRole("switch", { name: "Large text and simple screens" }).click();
    await expect(page.getByRole("switch", { name: "Large text and simple screens" })).toHaveAttribute("aria-checked", "true");
    const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const keys = Object.keys(stored);
    expect(keys.length).toBeGreaterThan(0);
    for (const value of Object.values(stored)) {
      expect(value).not.toMatch(/Sunita|HbA1c|diabet|token|9876500001/i);
    }
    await page.locator('nav a[href="/app"]').click();
    await expect(page.getByRole("link", { name: /Find a doctor/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /My reports/ })).toBeVisible();
  });

  test("lists every permission and revoking one sticks after a reload", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    const reports = page.getByRole("switch", { name: "Read my reports" });
    await expect(reports).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch")).toHaveCount(5);
    await reports.click();
    await expect(reports).toHaveAttribute("aria-checked", "false");
    await page.reload();
    await expect(page.getByRole("switch", { name: "Read my reports" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name: "Understand my symptoms" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: "Read my reports" }).click();
    await expect(page.getByRole("switch", { name: "Read my reports" })).toHaveAttribute("aria-checked", "true");
  });

  test("shows family profiles and adds a new one", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    const family = page.getByRole("region", { name: "Family profiles" });
    await expect(family.getByText("Sunita Patil")).toBeVisible();
    await family.getByRole("button", { name: "Add a family member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill("Ramesh Patil");
    await dialog.getByLabel("Age", { exact: true }).fill("74");
    await dialog.getByLabel("Relation").selectOption("father");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(family.getByText("Ramesh Patil")).toBeVisible();
    await page.locator('nav a[href="/app"]').click();
    await expect(page.getByRole("button", { name: /^Ramesh ·/ })).toBeVisible();
  });

  test("signing out returns to the landing page and closes the app", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/welcome/);
  });
});

test.describe("accessibility and layout", () => {
  test("has no serious violations", async ({ page }) => {
    await startDemo(page);
    await openSettings(page);
    await expectNoSeriousViolations(page);
  });

  test("no horizontal scroll at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?fast=1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Try the demo" }).click();
    await onboard(page);
    await page.goto("/app/settings?fast=1");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
