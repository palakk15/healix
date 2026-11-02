import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, onboard, resetWorld, startDemo } from "./helpers";

const sample = "server/mock/data/reports/diabetes-panel.png";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function openReports(page: Page) {
  await page.locator('nav a[href="/app/reports"]').click();
  await expect(page.getByRole("heading", { name: "My reports" })).toBeVisible();
}

async function uploadSample(page: Page) {
  await page.getByRole("link", { name: "Upload a report" }).or(page.getByRole("link", { name: "Upload", exact: true })).first().click();
  await page.getByTestId("report-file").setInputFiles(sample);
  await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 20_000 });
}

test.describe("report list", () => {
  test("shows earlier reports as cards with the number of flags", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    const list = page.getByRole("list", { name: "My reports" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByText("Lipid profile")).toBeVisible();
    await expect(list.getByText("Kothrud Family Lab")).toBeVisible();
    await expect(list.getByText("2 to discuss").first()).toBeVisible();
  });
});

test.describe("upload (demo step 5)", () => {
  test("asks for permission first when reports were not allowed", async ({ page }) => {
    await page.goto("/?fast=1");
    await page.getByRole("link", { name: /Try the demo/ }).first().click();
    await onboard(page, undefined, { consents: [0] });
    await openReports(page);
    await page.getByRole("link", { name: "Upload a report" }).or(page.getByRole("link", { name: "Upload", exact: true })).first().click();
    await expect(page.getByTestId("report-file")).toHaveCount(0);
    await page.getByRole("button", { name: "Allow reading my reports" }).click();
    await expect(page.getByTestId("report-file")).toHaveCount(1);
  });

  test("rejects a file type that cannot be read", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    await page.getByRole("link", { name: "Upload", exact: true }).click();
    await page.getByTestId("report-file").setInputFiles({ name: "archive.zip", mimeType: "application/zip", buffer: Buffer.from("hello") });
    await expect(page.getByRole("alert")).toHaveText("Please choose a photo, a PDF, a Word file or a text file.");
  });

  test("reads the report with calm progress and lands on the review step", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    await page.getByRole("link", { name: "Upload", exact: true }).click();
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("status")).toHaveText(/Reading your report…|Checking values…/);
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("review (mandatory before Explain)", () => {
  test("shows the original beside the values, highlights the low-confidence one and lets it be fixed", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    await uploadSample(page);

    await expect(page.getByRole("img", { name: "Photo of your lab report" })).toBeVisible();
    await expect(page.getByTestId("marker-FBS")).toHaveAttribute("data-attention", "true");
    await expect(page.getByTestId("marker-HBA1C")).toHaveAttribute("data-attention", "false");
    await expect(page.getByTestId("row-FBS")).toHaveAttribute("data-attention", "true");
    await expect(page.getByTestId("row-FBS").getByText("Please check")).toBeVisible();
    await expect(page.getByTestId("row-HBA1C").getByText("Please check")).toHaveCount(0);
    await expect(page.getByText("1 value to check")).toBeVisible();

    const fasting = page.getByLabel("Fasting glucose");
    await expect(fasting).toHaveValue("152");
    await expect(page.getByTestId("row-HBA1C").getByText("Usual range 4 to 5.6 %")).toBeVisible();

    await fasting.fill("abc");
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("alert")).toHaveText("Enter a number for Fasting glucose.");
    await expect(fasting).toHaveAttribute("aria-invalid", "true");

    await fasting.fill("132");
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
    await expect(page.getByTestId("value-FBS")).toHaveText("132");
  });

  test("Explain is refused until the values are confirmed", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    await uploadSample(page);
    const reportId = page.url().match(/reports\/([^/]+)\/review/)?.[1];
    expect(reportId).toBeTruthy();
    await page.evaluate((id) => {
      window.history.pushState({}, "", `/app/reports/${id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, reportId);
    await expect(page.getByRole("heading", { name: "Check the values first" })).toBeVisible();
    await page.getByRole("link", { name: "Check the values" }).click();
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible();
  });
});

test.describe("explain (demo step 5)", () => {
  async function reachExplain(page: Page) {
    await startDemo(page);
    await openReports(page);
    await uploadSample(page);
    await page.getByLabel("Fasting glucose").fill("132");
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
  }

  test("an ink summary, a card per flagged test, one line for the normal ones", async ({ page }) => {
    await reachExplain(page);
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("HbA1c has come down since the earlier report");

    const hba1c = page.getByRole("article", { name: "HbA1c" });
    await expect(hba1c.getByTestId("value-HBA1C")).toHaveText("7.1");
    await expect(hba1c.getByText("Above the usual range", { exact: true })).toBeVisible();
    await expect(hba1c.getByRole("img", { name: /on its usual range/ })).toBeVisible();
    await expect(hba1c.getByText("Usual range 4 to 5.6 %")).toBeVisible();
    await expect(hba1c.getByTestId("sparkline")).toBeVisible();
    await expect(hba1c.getByText("Earlier 7.9, now 7.1 %")).toBeVisible();

    await expect(page.getByRole("article", { name: "Fasting glucose" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Triglycerides" })).toHaveCount(0);
    await expect(page.getByTestId("normal-line")).toHaveText("In the usual range: Triglycerides.");
  });

  test("notes a repeated test, with the exact wording, only where it applies", async ({ page }) => {
    await reachExplain(page);
    const cholesterol = page.getByRole("article", { name: "Total cholesterol" });
    await expect(cholesterol.getByRole("note")).toHaveText("You had this test 20 days ago. Ask your doctor whether repeating it is needed.");
    await expect(page.getByRole("article", { name: "HbA1c" }).getByRole("note")).toHaveCount(0);
  });

  test("a parchi with doctor questions, a way to save and share, the disclaimer and a doctor action", async ({ page }) => {
    await reachExplain(page);
    const parchi = page.getByTestId("parchi");
    await expect(parchi.getByRole("heading", { name: "Questions to ask your doctor" })).toBeVisible();
    await expect(parchi.getByRole("listitem")).toHaveCount(4);
    await expect(parchi).toContainText("What HbA1c target is right for me?");

    const download = page.waitForEvent("download");
    await parchi.getByRole("button", { name: "Save" }).click();
    expect((await download).suggestedFilename()).toBe("questions-for-my-doctor.txt");
    await expect(parchi.getByRole("status")).toHaveText("Saved to your device");

    await expect(page.getByText(/Guidance, not|It is guidance, not a diagnosis/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "See a doctor sooner if" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consult a doctor" })).toHaveAttribute("href", /\/app\/doctors\?specialty=General%20Physician/);
  });

  test("explains in the patient's language", async ({ page }) => {
    await page.goto("/?fast=1&lang=mr");
    await page.getByRole("link", { name: /डेमो वापरून पहा/ }).first().click();
    const { marathi } = await import("./helpers");
    await onboard(page, marathi);
    await page.locator('nav a[href="/app/reports"]').click();
    await page.getByRole("link", { name: "अपलोड", exact: true }).click();
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("heading", { name: "मूल्ये तपासा" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "मूल्ये निश्चित करा" }).click();
    await expect(page.getByRole("region", { name: "सारांश" })).toContainText("HbA1c");
    await expect(page.getByTestId("parchi")).toContainText("माझे मधुमेहाचे औषध बदलावे का?");
  });
});

test.describe("accessibility and layout", () => {
  test("list, upload, review and explain have no serious violations", async ({ page }) => {
    await startDemo(page);
    await openReports(page);
    await expectNoSeriousViolations(page);
    await page.getByRole("link", { name: "Upload", exact: true }).click();
    await expectNoSeriousViolations(page);
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 20_000 });
    await expectNoSeriousViolations(page);
    await page.getByLabel("Fasting glucose").fill("132");
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("no horizontal scroll on the report screens at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?fast=1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Try the demo" }).click();
    await onboard(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await openReports(page);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("link", { name: "Upload", exact: true }).click();
    await page.getByTestId("report-file").setInputFiles(sample);
    await expect(page.getByRole("heading", { name: "Check the values" })).toBeVisible({ timeout: 20_000 });
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByLabel("Fasting glucose").fill("132");
    await page.getByRole("button", { name: "Confirm values" }).click();
    await expect(page.getByRole("heading", { name: "Diabetes check-up" })).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
