import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectNoSeriousViolations, resetWorld } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function openDashboard(page: Page) {
  await page.goto("/?fast=1");
  await page.getByRole("button", { name: "See the dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Today at a glance" })).toBeVisible();
}

async function goTo(page: Page, name: string, heading: string) {
  await page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
}

async function sendPreAlert(request: APIRequestContext) {
  const login = await request.post("/api/auth/login", { data: { phone: "9876500001", otp: "123456" } });
  const auth = (await login.json()) as { access_token: string; user: { profiles: Array<{ id: string }> } };
  const response = await request.post("/api/emergency", {
    headers: { Authorization: `Bearer ${auth.access_token}` },
    data: { lat: 18.5074, lng: 73.8077, profile_id: auth.user.profiles[0]?.id, summary: "Chest pain and sweating" },
  });
  expect(response.ok()).toBe(true);
}

test.describe("overview", () => {
  test("shows total waiting, an estimated average wait and the busiest doctor", async ({ page }) => {
    await openDashboard(page);
    await expect(page.getByTestId("stat-waiting")).toHaveText(/^\d+$/);
    const average = page.getByRole("region", { name: "Average wait" });
    await expect(average.getByText("Estimate", { exact: true })).toBeVisible();
    await expect(page.getByTestId("stat-average")).toHaveText(/\d+ min/);
    await expect(page.getByRole("region", { name: "Busiest doctor" })).toContainText("Dr.");
  });

  test("a patient cannot open the dashboard", async ({ page }) => {
    await page.goto("/hospital?fast=1");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("live queues", () => {
  test("lists every doctor with now serving, waiting, predicted wait and status", async ({ page }) => {
    await openDashboard(page);
    await goTo(page, "Live queues", "Live queues");
    const rows = page.locator('tr[data-testid^="queue-"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(2);
    const first = rows.first();
    await expect(first.getByRole("rowheader")).toContainText("Dr.");
    await expect(first.getByRole("cell").nth(2)).toHaveText(/\d+ min/);
    await expect(first.getByText(/Running|Delayed|On break|Closed|On leave/)).toBeVisible();
  });

  test("Complete finishes the current patient, then Call next calls the next one", async ({ page }) => {
    await openDashboard(page);
    await goTo(page, "Live queues", "Live queues");
    const candidate = page.locator('tr[data-testid^="queue-"]').filter({ has: page.locator('button:not([disabled])', { hasText: "Complete" }) }).first();
    await expect(candidate).toBeVisible();
    const rowId = await candidate.getAttribute("data-testid");
    const row = page.getByTestId(rowId ?? "");
    await expect(row.getByRole("button", { name: /Call next patient for/ })).toBeDisabled();
    await row.getByRole("button", { name: /Complete current patient for/ }).click();
    await expect(row.getByRole("button", { name: /Call next patient for/ })).toBeEnabled();
    await row.getByRole("button", { name: /Call next patient for/ }).click();
    await expect(row.getByRole("button", { name: /Complete current patient for/ })).toBeEnabled();
  });
});

test.describe("live queues are interactive", () => {
  async function queues(page: Page) {
    await openDashboard(page);
    await goTo(page, "Live queues", "Live queues");
    await expect(page.locator('tr[data-testid^="queue-"]').first()).toBeVisible();
  }

  test("searches, filters by status and sorts the doctors", async ({ page }) => {
    await queues(page);
    const rows = page.locator('tr[data-testid^="queue-"]');
    const all = await rows.count();
    expect(all).toBeGreaterThan(5);

    await page.getByRole("searchbox", { name: "Search doctors" }).fill("meera");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Dr. Meera Kulkarni");
    await page.getByRole("searchbox", { name: "Search doctors" }).fill("zzzz");
    await expect(page.getByTestId("no-rows")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search doctors" }).fill("cardio");
    await expect(rows.first()).toContainText("Cardiologist");
    await page.getByRole("searchbox", { name: "Search doctors" }).fill("");

    await page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: "Running" }).click();
    const running = await rows.count();
    expect(running).toBeLessThanOrEqual(all);
    for (const text of await rows.locator("td:nth-child(5)").allTextContents()) expect(text.trim()).toBe("Running");
    await page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: "All", exact: true }).click();
    await expect(rows).toHaveCount(all);

    await page.getByRole("group", { name: "Sort by" }).getByRole("button", { name: "Name" }).click();
    const names = (await rows.locator("th button span span").allTextContents()).filter((text) => text.startsWith("Dr."));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await page.getByRole("group", { name: "Sort by" }).getByRole("button", { name: "Most waiting" }).click();
    const waiting = (await rows.locator("td:nth-child(3)").allTextContents()).map(Number);
    expect(waiting).toEqual([...waiting].sort((a, b) => b - a));
  });

  test("clicking a doctor opens their queue with the patients and controls", async ({ page }) => {
    await queues(page);
    await page.getByRole("button", { name: "Open the queue for Dr. Meera Kulkarni" }).click();
    const drawer = page.getByTestId("queue-drawer");
    await expect(drawer.getByRole("heading", { name: "Dr. Meera Kulkarni" })).toBeVisible();
    await expect(drawer.getByTestId("drawer-now-serving")).toHaveText("A-18");
    await expect(drawer.getByTestId("drawer-token")).toHaveCount(3);
    await expect(drawer.getByTestId("drawer-token").first()).toHaveAttribute("data-status", "called");
    await expect(drawer.getByRole("button", { name: "Call next", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "Open the queue for Dr. Meera Kulkarni" })).toBeFocused();
  });

  test("adds a walk-in, completes, calls, skips a no-show and the table follows", async ({ page }) => {
    await queues(page);
    const row = page.getByTestId("queue-doc_meera");
    const waitingBefore = Number(await row.locator("td").nth(1).textContent());
    await page.getByRole("button", { name: "Open the queue for Dr. Meera Kulkarni" }).click();
    const drawer = page.getByTestId("queue-drawer");

    await drawer.getByRole("button", { name: "Add walk-in" }).click();
    await expect(drawer.getByTestId("drawer-token")).toHaveCount(4);
    await expect(drawer.getByText("Walk-in patient").first()).toBeVisible();
    await expect(row.locator("td").nth(1)).toHaveText(String(waitingBefore + 1));

    await drawer.getByRole("button", { name: "Complete", exact: true }).first().click();
    await expect(drawer.getByTestId("drawer-token").first()).toHaveAttribute("data-status", "waiting");
    await drawer.getByRole("button", { name: "Call next", exact: true }).click();
    await expect(drawer.getByTestId("drawer-token").first()).toHaveAttribute("data-status", "called");
    await expect(drawer.getByTestId("drawer-now-serving")).not.toHaveText("A-18");

    const before = await drawer.getByTestId("drawer-token").count();
    await drawer.getByTestId("drawer-token").last().getByRole("button", { name: "Skip (no-show)" }).click();
    await expect(drawer.getByTestId("drawer-token")).toHaveCount(before - 1);
    await expect(drawer.getByText("Recently finished")).toBeVisible();
  });

  test("pauses the doctor and adds delay, and the table shows it", async ({ page }) => {
    await queues(page);
    const row = page.getByTestId("queue-doc_arjun");
    await page.getByRole("button", { name: "Open the queue for Dr. Arjun Rao" }).click();
    const drawer = page.getByTestId("queue-drawer");

    await drawer.getByRole("button", { name: "Pause" }).click();
    await expect(row.getByText("On break")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-pressed", "true");
    await drawer.getByRole("button", { name: "Resume" }).click();
    await expect(row.getByText("On break")).toHaveCount(0);

    await drawer.getByRole("button", { name: "Add 5 minutes of delay" }).click();
    await drawer.getByRole("button", { name: "Add 5 minutes of delay" }).click();
    await expect(drawer.getByTestId("drawer-delay")).toHaveText("10 min");
    await expect(row.getByText("Delayed")).toBeVisible();
    await drawer.getByRole("button", { name: "Reduce the delay by 5 minutes" }).click();
    await expect(drawer.getByTestId("drawer-delay")).toHaveText("5 min");
  });

  test("the drawer and the controls have no serious violations", async ({ page }) => {
    await queues(page);
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Open the queue for Dr. Meera Kulkarni" }).click();
    await expect(page.getByTestId("queue-drawer")).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test.describe("booking modes", () => {
  test("every doctor has their own description, not a shared sentence", async ({ page }) => {
    await openDashboard(page);
    await goTo(page, "Booking modes", "Booking modes");
    const cards = page.locator('[data-testid^="mode-"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);
    const texts = await cards.locator("p.type-small").allTextContents();
    const descriptions = texts.filter((text) => text.length > 60);
    expect(descriptions.length).toBe(await cards.count());
    expect(new Set(descriptions).size).toBe(descriptions.length);
    await expect(page.getByTestId("mode-doc_meera")).toContainText("7.8");
  });
});

test.describe("analytics", () => {
  test("shows the model error beside the simple formula, and three charts with text tables", async ({ page }) => {
    await openDashboard(page);
    await goTo(page, "Analytics", "Analytics");
    await expect(page.getByTestId("mae-model")).toHaveText("3.9 min");
    await expect(page.getByTestId("mae-simple")).toHaveText("9.0 min");
    await expect(page.getByText(/57% closer/)).toBeVisible();
    await expect(page.locator(".recharts-wrapper")).toHaveCount(3);
    await expect(page.getByRole("table", { name: "Predicted and actual wait" })).toHaveCount(1);
    await expect(page.getByRole("table", { name: "Patients per hour" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 }).locator("xpath=..").getByText("Demo data")).toHaveCount(0);
    await expect(page.getByTestId("sample-note")).toHaveText("These charts use sample data until enough real visits have been recorded.");
  });
});

test.describe("simulator and booking modes (demo step 7)", () => {
  test("replaying a day moves the clock and flips a booking mode to pessimistic in the rush", async ({ page, request }) => {
    await openDashboard(page);
    await goTo(page, "Booking modes", "Booking modes");
    await expect(page.locator('[data-testid^="mode-"]').first()).toBeVisible();
    await goTo(page, "Queue simulator", "Queue simulator");
    await page.getByRole("button", { name: "Replay a day in 2 minutes" }).click();
    await expect(page.getByText("Replaying", { exact: true })).toBeVisible();
    await expect.poll(async () => Number((await page.getByTestId("sim-percent").textContent())?.match(/\d+/)?.[0] ?? 0), { timeout: 20_000 }).toBeGreaterThan(10);

    const token = (await (await request.post("/api/auth/login", { data: { phone: "9000000001", otp: "123456" } })).json()) as { access_token: string };
    await expect
      .poll(
        async () => {
          const modes = (await (await request.get("/api/dashboard/booking-modes", { headers: { Authorization: `Bearer ${token.access_token}` } })).json()) as { modes: Array<{ mode: string }> };
          return modes.modes.some((entry) => entry.mode === "pessimistic");
        },
        { timeout: 25_000, intervals: [500] },
      )
      .toBe(true);

    await goTo(page, "Booking modes", "Booking modes");
    await expect(page.locator('[data-mode="pessimistic"]').first()).toBeVisible();
    await expect(page.locator('[data-mode="pessimistic"]').first().getByText("Pessimistic", { exact: true })).toBeVisible();
  });

  test("Stop and Reset bring the simulator back to live", async ({ page }) => {
    await openDashboard(page);
    await goTo(page, "Queue simulator", "Queue simulator");
    await page.getByRole("button", { name: "Replay a day in 2 minutes" }).click();
    await expect(page.getByText("Replaying", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});

test.describe("emergency pre-alerts", () => {
  test("an incoming alert appears with the patient, age, summary and arrival time", async ({ page, request }) => {
    await openDashboard(page);
    await goTo(page, "Emergency pre-alerts", "Emergency pre-alerts");
    await expect(page.getByTestId("no-alerts")).toBeVisible();
    await sendPreAlert(request);
    const alert = page.getByTestId("pre-alert").first();
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText("Chest pain and sweating");
    await expect(alert).toContainText(/Arriving in about \d+ min/);
    await expect(alert).toHaveClass(/alert-in/);
  });
});

test.describe("accessibility and layout", () => {
  test("every dashboard page has no serious violations", async ({ page, request }) => {
    await openDashboard(page);
    await expectNoSeriousViolations(page);
    await goTo(page, "Live queues", "Live queues");
    await expectNoSeriousViolations(page);
    await goTo(page, "Analytics", "Analytics");
    await expect(page.locator(".recharts-wrapper")).toHaveCount(3);
    await expectNoSeriousViolations(page);
    await goTo(page, "Booking modes", "Booking modes");
    await expectNoSeriousViolations(page);
    await goTo(page, "Queue simulator", "Queue simulator");
    await expectNoSeriousViolations(page);
    await sendPreAlert(request);
    await goTo(page, "Emergency pre-alerts", "Emergency pre-alerts");
    await expect(page.getByTestId("pre-alert").first()).toBeVisible({ timeout: 10_000 });
    await expectNoSeriousViolations(page);
  });

  test("no horizontal page scroll on a laptop width", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openDashboard(page);
    await goTo(page, "Live queues", "Live queues");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
