import { expect, test } from "@playwright/test";
import { expectNoSeriousViolations, holdPointer, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test.describe("emergency page", () => {
  test("lists exactly what will be shared before anything is sent", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/emergency?fast=1");
    const list = page.getByTestId("share-list");
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(list).toContainText("Name: Sunita Patil");
    await expect(list).toContainText("Age: 58");
    await expect(list).toContainText("Why:");
    await expect(list).toContainText("Your live location");
    await expect(page.getByText("Nothing else is sent.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Call 102/ })).toHaveAttribute("href", "tel:102");
  });

  test("a short press cancels, a two second hold sends to the nearest hospital", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/emergency?fast=1");
    const hold = page.getByTestId("hold-button");
    await holdPointer(page, hold, 800);
    await expect(page.getByText(/Sent to/)).toHaveCount(0);
    await holdPointer(page, hold, 2400);
    await expect(page.getByText("Sent to Karve Road Care Clinic")).toBeVisible();
    await expect(page.getByText(/Estimated arrival in about \d+ min/)).toBeVisible();
    await expect(page.getByTestId("share-list")).toHaveCount(0);
  });

  test("has no serious violations", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/emergency?fast=1");
    await expect(page.getByTestId("share-list")).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});
