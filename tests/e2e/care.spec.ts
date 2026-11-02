import { expect, test } from "@playwright/test";
import { bookTopPick, expectNoSeriousViolations, goToSymptoms, marathi, reachDoctors, resetWorld, staffToken, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

test.describe("doctors list (demo step 2)", () => {
  test("ranks the top pick first with fee, rating, estimate with its range, and why", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);

    const top = page.getByRole("article", { name: "Dr. Meera Kulkarni" });
    await expect(top.getByText("Top pick", { exact: true })).toBeVisible();
    await expect(top.getByText("Speaks English · 2.1 km · About 25 min")).toBeVisible();
    await expect(top.getByText("Estimate", { exact: true })).toBeVisible();
    await expect(top.getByText("Between 22 and 28 min")).toBeVisible();
    await expect(top.getByText("₹700 per visit")).toBeVisible();
    await expect(top.getByLabel("Rated 4.8")).toBeVisible();
    await expect(top.getByText(/2\.1 km away/)).toBeVisible();
    await expect(top.getByRole("button", { name: "Book top pick" })).toBeVisible();
    await expect(top.getByRole("link", { name: "See times" })).toHaveAttribute("href", /^\/app\/doctors\/doc_meera\?date=\d{4}-\d\d-\d\d&time=any&purpose=new$/);

    const articles = page.getByRole("article");
    expect(await articles.count()).toBeGreaterThan(1);
    await expect(articles.first()).toHaveAccessibleName("Dr. Meera Kulkarni");
    await expect(page.getByText("Top pick", { exact: true })).toHaveCount(1);
  });

  test("shows the best times to visit, with minutes saved", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await expect(page.getByRole("heading", { name: "Best time to visit" })).toBeVisible();
    await expect(page.getByText(/Save about \d+ min/).first()).toBeVisible();
  });

  test("highlights the patient's own language in their own script", async ({ page }) => {
    await startDemo(page, marathi);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "तुमची लक्षणे सांगा" }).fill("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून");
    await page.getByRole("button", { name: "पाठवा" }).click();
    await page.getByRole("link", { name: "माझ्या जवळचे डॉक्टर दाखवा" }).click();

    const top = page.getByRole("article", { name: "Dr. Meera Kulkarni" });
    await expect(top.getByText("मराठी बोलतात · 2.1 किमी · सुमारे 25 मिनिटे")).toBeVisible();
    await expect(top.getByText("सर्वोत्तम पर्याय", { exact: true })).toBeVisible();
    await expect(top.getByText("अंदाज", { exact: true })).toBeVisible();
    await expect(top.getByText("25 ते 25")).toHaveCount(0);
    const highlighted = top.locator("span.bg-accent-soft", { hasText: "मराठी" });
    await expect(highlighted).toHaveCount(1);
    await expect(top.locator("span.bg-accent-soft", { hasText: "हिन्दी" })).toHaveCount(0);
    await expect(top.getByText("हिन्दी", { exact: true })).toBeVisible();
  });

  test("filters by fee, distance and language, and says so when nothing matches", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await page.getByText("Filters", { exact: true }).click();

    await page.getByRole("radio", { name: "Up to ₹500" }).click();
    await expect(page.getByText("No doctors match these filters")).toBeVisible();
    await expect(page.getByText("Try a wider distance or a higher fee.")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);

    await page.getByRole("radio", { name: "Any fee" }).click();
    await expect(page.getByRole("article", { name: "Dr. Meera Kulkarni" })).toBeVisible();

    await page.getByRole("radio", { name: "Within 3 km" }).click();
    await expect(page.getByRole("article", { name: "Dr. Meera Kulkarni" })).toBeVisible();
    for (const text of await page.getByText(/^\d+(\.\d)? km away/).allInnerTexts()) expect(parseFloat(text)).toBeLessThanOrEqual(3);

    await page.getByRole("radio", { name: "Any distance" }).click();
    await page.getByRole("radio", { name: "मराठी" }).click();
    const cards = page.getByRole("article");
    for (let index = 0; index < (await cards.count()); index += 1) await expect(cards.nth(index).getByText("मराठी", { exact: true })).toBeVisible();
  });
});

test.describe("booking (demo step 2)", () => {
  test("book top pick asks first, loses the race, then rebooks the next free time", async ({ page }) => {
    const attempts: Array<{ key: string | undefined; slot: string }> = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/bookings") && request.method() === "POST") {
        attempts.push({ key: request.headers()["idempotency-key"], slot: (request.postDataJSON() as { slot_start: string }).slot_start });
      }
    });
    await startDemo(page);
    await reachDoctors(page);

    await page.getByRole("button", { name: "Book top pick" }).click();
    const dialog = page.getByRole("dialog", { name: "Confirm your booking" });
    await expect(dialog).toContainText("Dr. Meera Kulkarni · Karve Road Care Clinic");
    await expect(dialog).toContainText("Fee ₹700 per visit");
    await expect(dialog).toContainText(/(Today|Tomorrow) at \d+:\d\d (AM|PM)/);
    expect(attempts).toHaveLength(0);

    await dialog.getByRole("button", { name: "Confirm booking" }).click();
    const taken = dialog.getByRole("alert");
    await expect(taken).toContainText(/Just taken\. Next free time: \d+:\d\d (AM|PM)/);
    await expect(dialog.getByRole("button", { name: "Confirm booking" })).toBeDisabled();
    await expect(taken).not.toContainText(/slot_taken|409|error/i);

    await taken.getByRole("button", { name: /^Book \d+:\d\d/ }).click();
    await expect(page).toHaveURL(/\/app\/token\/tok_/);

    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.key).toBeTruthy();
    expect(attempts[1]?.key).toBeTruthy();
    expect(attempts[0]?.key).not.toBe(attempts[1]?.key);
    expect(attempts[1]?.slot).not.toBe(attempts[0]?.slot);
    expect(new Date(attempts[1]?.slot ?? 0).getTime()).toBeGreaterThan(new Date(attempts[0]?.slot ?? 0).getTime());
  });

  test("cancelling the dialog books nothing", async ({ page }) => {
    let bookings = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/bookings")) bookings += 1;
    });
    await startDemo(page);
    await reachDoctors(page);
    await page.getByRole("button", { name: "Book top pick" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(bookings).toBe(0);
  });

  test("the booking page lets you pick today or tomorrow and handles the same race", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await page.getByRole("article", { name: "Dr. Meera Kulkarni" }).getByRole("link", { name: "See times" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dr. Meera Kulkarni");
    await expect(page.getByText("Booking for Sunita Patil")).toBeVisible();
    const tabs = page.getByRole("tablist");
    await expect(tabs.getByRole("tab", { name: "Today" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "Tomorrow" })).toBeVisible();
    await tabs.getByRole("tab", { name: "Tomorrow" }).click();
    await expect(tabs.getByRole("tab", { name: "Tomorrow" })).toHaveAttribute("aria-selected", "true");

    const book = page.getByRole("button", { name: "Pick a time" });
    await expect(book).toBeDisabled();
    await page.getByRole("radiogroup", { name: "Pick a time" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: /^Book \d+:\d\d/ }).click();
    await expect(page.getByRole("alert")).toContainText("Just taken. Next free time:");
    await page.getByRole("alert").getByRole("button").click();
    await expect(page).toHaveURL(/\/app\/token\/tok_/);
  });
});

test.describe("token screen (demo step 3)", () => {
  test("leave home in 25 min, the ticket, the estimate and the reasons behind it", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Leave home in 2[45] min/);
    await expect(page.getByText(/by 10:3\d AM · 18 min by auto/)).toBeVisible();
    await expect(page.getByTestId("ticket-number")).toHaveText("A-23");
    await expect(page.getByText("Now serving")).toBeVisible();
    await expect(page.getByText("A-18", { exact: true })).toBeVisible();
    await expect(page.getByText("5 ahead of you").first()).toBeVisible();
    await expect(page.getByText("Room 4").first()).toBeVisible();

    const why = page.getByRole("heading", { name: "Why this estimate" }).locator("../..");
    await expect(why.getByText("Estimate", { exact: true })).toBeVisible();
    const rows = why.locator("ul li");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Morning rush");
    await expect(rows.nth(0)).toContainText("+12m");
    await expect(rows.nth(1)).toContainText("Doctor started late");
    await expect(rows.nth(1)).toContainText("+8m");
    await expect(rows.nth(2)).toContainText("Quick follow-ups ahead");
    await expect(rows.nth(2)).toContainText("−6m");
    await expect(rows.nth(0).locator(".type-data")).toHaveClass(/text-alert-text/);
    await expect(rows.nth(2).locator(".type-data")).toHaveClass(/text-accent/);
    await expect(why.getByText("Between 47 and 59 min")).toBeVisible();
  });

  test("the Token tab finds the current token, and home shows it as a ticket", async ({ page }) => {
    await startDemo(page);
    await page.getByRole("link", { name: "Token", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No token yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Find a doctor" })).toBeVisible();

    await reachDoctors(page);
    await bookTopPick(page);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("link", { name: "Your token today" })).toContainText("A-23");
    await page.getByRole("link", { name: "Token", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/token\/tok_/);
    await expect(page.getByTestId("ticket-number")).toHaveText("A-23");
  });

  test("an incoming swap request appears as a sheet with only token numbers; accepting updates the numbers live", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);

    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await expect(sheet).toContainText("Someone behind you asks to swap");
    await expect(sheet).toContainText("Token A-24 would like your place. You would move to A-23.");
    await expect(sheet).not.toContainText(/Sunita|Patil|Shanta|Dr\./);
    await sheet.getByRole("button", { name: "Accept" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("ticket-number")).toHaveText("A-24", { timeout: 10_000 });
    await expect(page.getByText("6 ahead of you").first()).toBeVisible();
  });

  test("declining an incoming swap leaves the numbers alone", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole("button", { name: "Decline" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("ticket-number")).toHaveText("A-23");
  });

  test("asking the person ahead: one request at a time, three at most, token numbers only", async ({ page }) => {
    test.setTimeout(90_000);
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole("button", { name: "Decline" }).click();

    const ask = page.getByRole("button", { name: "Ask the person ahead to swap" });
    await expect(page.getByText("0 of 3 requests used")).toBeVisible();

    await ask.click();
    await expect(page.getByText("They see only your token number, never your name.")).toBeVisible();
    const choices = page.getByRole("radiogroup", { name: "Choose a token" }).getByRole("radio");
    await expect(choices).toHaveText(["A-19", "A-20", "A-21", "A-22"]);
    await expect(page.getByRole("button", { name: "Send request" })).toBeDisabled();
    await choices.filter({ hasText: "A-22" }).click();
    await expect(page.getByLabel("Message")).toHaveValue("Could we swap places, please?");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Waiting for A-22 to answer" })).toBeVisible();
    await expect(page.getByText(/Expires in [45]:\d\d/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask the person ahead to swap" })).toBeDisabled();
    await expect(page.getByText("Wait for the current request to be answered first.")).toBeVisible();

    await expect(page.getByText("A-22 agreed. You swapped places.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ticket-number")).toHaveText("A-22");
    await expect(page.getByText("1 of 3 requests used")).toBeVisible();

    for (const [target, used] of [["A-21", 2], ["A-20", 3]] as const) {
      await page.getByRole("button", { name: "Ask the person ahead to swap" }).click();
      await page.getByRole("radiogroup", { name: "Choose a token" }).getByRole("radio").filter({ hasText: target }).click();
      await page.getByRole("button", { name: "Send request" }).click();
      await expect(page.getByText(`${target} agreed. You swapped places.`)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(`${used} of 3 requests used`)).toBeVisible();
    }
    await expect(page.getByTestId("ticket-number")).toHaveText("A-20");
    await expect(page.getByRole("button", { name: "Ask the person ahead to swap" })).toBeDisabled();
    await expect(page.getByText("All 3 requests for this token are used.")).toBeVisible();
  });

  test("the queue moves live, and a wait that changes by more than 15 minutes raises an alert", async ({ page, request }) => {
    test.setTimeout(120_000);
    await startDemo(page);
    await reachDoctors(page);
    await bookTopPick(page);
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible({ timeout: 20_000 });
    await sheet.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Your wait has changed" })).toHaveCount(0);

    const token = await staffToken(request);
    await request.post("/api/mock/simulator/speed", { headers: { authorization: `Bearer ${token}` }, data: { speed: 60 } });

    await expect(page.getByText("A-18", { exact: true })).toHaveCount(0, { timeout: 60_000 });
    const banner = page.getByRole("alert").filter({ hasText: "Your wait has changed" });
    await expect(banner).toBeVisible({ timeout: 60_000 });
    await expect(banner).toContainText(/It is now about \d+ min shorter than before\./);
  });
});

test.describe("accessibility and layout", () => {
  test("doctors, the confirm dialog, booking and token screens have no serious violations", async ({ page }) => {
    await startDemo(page);
    await reachDoctors(page);
    await expectNoSeriousViolations(page);

    await page.getByText("Filters", { exact: true }).click();
    await expectNoSeriousViolations(page);

    await page.getByRole("button", { name: "Book top pick" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("article", { name: "Dr. Meera Kulkarni" }).getByRole("link", { name: "See times" }).click();
    await expect(page.getByRole("tablist")).toBeVisible();
    await expectNoSeriousViolations(page);

    await page.getByRole("radiogroup", { name: "Pick a time" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: /^Book \d+:\d\d/ }).click();
    await page.getByRole("alert").getByRole("button").click();
    await expect(page.getByTestId("ticket-number")).toBeVisible();
    await expectNoSeriousViolations(page);

    await expect(page.getByTestId("sheet")).toBeVisible({ timeout: 20_000 });
    await expectNoSeriousViolations(page);
    await page.getByTestId("sheet").getByRole("button", { name: "Decline" }).click();
    await page.getByRole("button", { name: "Ask the person ahead to swap" }).click();
    await expectNoSeriousViolations(page);
  });

  test("no horizontal scroll on doctors, booking and token at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?fast=1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Try the demo" }).click();
    const { onboard } = await import("./helpers");
    await onboard(page);
    await reachDoctors(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("article", { name: "Dr. Meera Kulkarni" }).getByRole("link", { name: "See times" }).click();
    await expect(page.getByRole("tablist")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.getByRole("radiogroup", { name: "Pick a time" }).getByRole("radio").first().click();
    await page.getByRole("button", { name: /^Book \d+:\d\d/ }).click();
    await page.getByRole("alert").getByRole("button").click();
    await expect(page.getByTestId("ticket-number")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
});
