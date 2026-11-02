import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function openCommunity(page: Page) {
  await startDemo(page);
  await page.getByRole("link", { name: /Community/ }).first().click();
  await expect(page.getByRole("heading", { name: "Community", level: 1 })).toBeVisible();
}

test.describe("community", () => {
  test("is a box on the home screen next to reports, doctors and Healix AI", async ({ page }) => {
    await startDemo(page);
    for (const name of [/My reports/, /Find a doctor/, /Healix AI/, /Community/]) await expect(page.getByRole("link", { name }).first()).toBeVisible();
    await page.getByRole("link", { name: /Community/ }).first().click();
    await expect(page).toHaveURL(/\/app\/community$/);
    await expect(page).toHaveTitle("Community · Healix");
  });

  test("lists posts, topics with counts, and keeps everyone anonymous", async ({ page }) => {
    await openCommunity(page);
    await expect(page.getByRole("article").first()).toBeVisible();
    expect(await page.getByRole("article").count()).toBeGreaterThanOrEqual(10);
    await expect(page.getByRole("group", { name: "Topics" }).getByRole("button", { name: /Diabetes/ })).toContainText(/\d/);
    await expect(page.getByText("My HbA1c came down from 7.9 to 7.1 in five months")).toBeVisible();
    await expect(page.getByText(/by Calm Heron/)).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Sunita");
    await expect(page.getByText(/Community members are not doctors/).first()).toBeVisible();
  });

  test("filters by topic, searches and sorts by the top posts", async ({ page }) => {
    await openCommunity(page);
    await page.getByRole("group", { name: "Topics" }).getByRole("button", { name: /Heart health/ }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(page.getByText("How do you keep salt low without food tasting boring?")).toBeVisible();
    await expect(page.getByText("My HbA1c came down")).toHaveCount(0);

    await page.getByRole("button", { name: "All topics" }).click();
    await page.getByRole("searchbox", { name: "Search posts" }).fill("breakfast");
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("article").first()).toContainText("Healthy breakfast ideas");
    await page.getByRole("searchbox", { name: "Search posts" }).fill("");

    await page.getByRole("button", { name: "Top", exact: true }).click();
    await expect(page.getByRole("article").first()).toContainText("My HbA1c came down");
  });

  test("voting adds a point once, can be undone, and switches to a downvote", async ({ page }) => {
    await openCommunity(page);
    const post = page.getByRole("article", { name: /My HbA1c came down/ });
    const score = post.getByTestId("score");
    await expect(score).toHaveText("42");
    await post.getByRole("button", { name: "Upvote" }).click();
    await expect(score).toHaveText("43");
    await post.getByRole("button", { name: "Upvote" }).click();
    await expect(score).toHaveText("42");
    await post.getByRole("button", { name: "Downvote" }).click();
    await expect(score).toHaveText("41");
    await expect(post.getByRole("button", { name: "Downvote" })).toHaveAttribute("aria-pressed", "true");
  });

  test("opens a post with its replies and lets you reply under a nickname", async ({ page }) => {
    await openCommunity(page);
    await page.getByRole("link", { name: "My HbA1c came down from 7.9 to 7.1 in five months" }).click();
    await expect(page.getByRole("heading", { name: "My HbA1c came down from 7.9 to 7.1 in five months", level: 1 })).toBeVisible();
    await expect(page.getByTestId("comment")).toHaveCount(2);
    await page.getByLabel("Write a reply").fill("Thank you for sharing, this gives me hope.");
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(page.getByTestId("comment")).toHaveCount(3);
    await expect(page.getByTestId("comment").last()).toContainText("Thank you for sharing");
    await expect(page.getByTestId("comment").last()).toContainText("(you)");
    await expect(page.getByTestId("comment").last()).not.toContainText("Sunita");
  });

  test("rejects phone numbers, links and doses, then publishes a clean post that you can delete", async ({ page }) => {
    await openCommunity(page);
    await page.getByRole("button", { name: "New post" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Topic").selectOption("food");
    await dialog.getByLabel("Title").fill("Easy dinner ideas for high sugar");
    await dialog.getByLabel("Your post").fill("Call me on 9876543210 and I will share my full diet chart with you.");
    await dialog.getByRole("button", { name: "Post", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Please remove phone numbers to keep everyone private.");

    await dialog.getByLabel("Your post").fill("I take 500 mg of my medicine after dinner and still feel dizzy sometimes.");
    await dialog.getByRole("button", { name: "Post", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("medicine doses");

    await dialog.getByLabel("Your post").fill("Vegetable khichdi with curd and a short walk afterwards has worked well for me.");
    await dialog.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Easy dinner ideas for high sugar", level: 1 })).toBeVisible();
    await expect(page.getByText("(you)").first()).toBeVisible();

    await page.getByRole("button", { name: "Delete post" }).click();
    await expect(page.getByRole("heading", { name: "Community", level: 1 })).toBeVisible();
    await expect(page.getByText("Easy dinner ideas for high sugar")).toHaveCount(0);
  });

  test("reporting someone else's post says thank you", async ({ page }) => {
    await openCommunity(page);
    await page.getByRole("link", { name: "Foot care tips that my diabetes nurse taught me" }).click();
    await page.getByRole("button", { name: "Report" }).click();
    await expect(page.getByText("Thank you. We will review this post.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete post" })).toHaveCount(0);
  });

  test("has no serious accessibility problems on the list, a post and the new-post dialog", async ({ page }) => {
    await openCommunity(page);
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "New post" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousViolations(page);
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Healthy breakfast ideas under 10 minutes" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Healthy breakfast");
    await expectNoSeriousViolations(page);
  });

  test("works in Marathi, with topic names and post times translated", async ({ page }) => {
    await page.goto("/?lang=mr&fast=1");
    await page.getByRole("link", { name: /डेमो वापरून पहा/ }).first().click();
    const { onboard, marathi } = await import("./helpers");
    await onboard(page, marathi);
    await page.goto("/app/community?fast=1");
    await expect(page.getByRole("heading", { name: "कम्युनिटी", level: 1 })).toBeVisible();
    await expect(page.getByRole("group", { name: "विषय" }).getByRole("button", { name: /मधुमेह/ })).toBeVisible();
    await expect(page.getByText(/तासांपूर्वी/).first()).toBeVisible();
  });

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?fast=1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Sign in" }).click();
    const { onboard } = await import("./helpers");
    await onboard(page);
    await page.goto("/app/community?fast=1");
    await expect(page.getByRole("heading", { name: "Community", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
