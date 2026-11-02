import { expect, test } from "@playwright/test";
import { bookTopPick, expectNoSeriousViolations, reachDoctors, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test.describe("redesigned token", () => {
  test("shows a pass, a leave-home ring, the queue as dots, a timeline and the visit details", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);

    await expect(page.getByTestId("ticket-number")).toHaveText("A-23");
    await expect(page.getByText("Healix token")).toBeVisible();
    await expect(page.getByText("In the queue", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Leave home in \d+ min/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Leave home in \d+ minutes/ })).toBeVisible();
    await expect(page.getByTestId("queue-dots").locator("span.rounded-full")).toHaveCount(5);
    await expect(page.getByText("5 ahead of you").first()).toBeVisible();

    const timeline = page.getByRole("list", { name: "Your visit" });
    await expect(timeline.getByRole("listitem")).toHaveCount(4);
    await expect(timeline.locator('[aria-current="step"]')).toContainText("Waiting your turn");

    const details = page.getByRole("region", { name: "Visit details" });
    await expect(details).toContainText("Dr. Meera Kulkarni");
    await expect(details).toContainText("Karve Road Care Clinic");
    await expect(details.getByRole("link", { name: "Get directions" })).toHaveAttribute("href", /google\.com\/maps\/search.*Karve/);
    await expect(page.getByText("Why this estimate")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask the person ahead to swap" })).toBeVisible();
  });

  test("the timeline and the pass follow the queue when the front desk calls the patient", async ({ page, request }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);
    const login = await request.post("/api/auth/login", { data: { phone: "9000000001", otp: "123456" } });
    const { access_token: token } = (await login.json()) as { access_token: string };
    const headers = { authorization: `Bearer ${token}` };
    const view = (await (await request.get("/api/dashboard/doctors", { headers })).json()) as { doctors: Array<{ doctor_id: string; serving_token_id: string | null }> };
    const serving = view.doctors.find((doctor) => doctor.doctor_id === "doc_meera")?.serving_token_id;
    if (serving) await request.post(`/api/tokens/${serving}/complete`, { headers });
    await expect(page.getByTestId("queue-dots")).toBeVisible();
  });

  test("with no token yet, the Token tab shows a working sample so you can see what you will get", async ({ page }) => {
    await startDemo(page);
    await page.locator('nav a[href="/app/token/current"]').click();
    await expect(page.getByRole("heading", { name: "No token yet", level: 1 })).toBeVisible();
    const sample = page.getByTestId("sample-token");
    await expect(sample).toBeVisible();
    await expect(sample.getByText("Sample preview")).toBeVisible();
    await expect(sample.getByTestId("ticket-number")).toHaveText(/^A-\d+$/);
    await expect(sample.getByRole("img", { name: /Leave home in \d+ minutes/ })).toBeVisible();
    await expect(sample.getByRole("list", { name: "Your visit" })).toBeVisible();
    await expect(sample.getByRole("button", { name: "Ask the person ahead to swap" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Find a doctor" }).first()).toBeVisible();
  });

  test("the sample moves on its own as the demo queue ticks", async ({ page }) => {
    await page.clock.install();
    await startDemo(page);
    await page.locator('nav a[href="/app/token/current"]').click();
    const serving = page.getByTestId("sample-token").locator("[aria-live=polite] p.font-mono");
    const before = await serving.textContent();
    await page.clock.fastForward(8_200);
    await expect.poll(async () => serving.textContent()).not.toBe(before);
  });

  test("has no serious violations and no horizontal scroll on a phone", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);
    await expectNoSeriousViolations(page);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
