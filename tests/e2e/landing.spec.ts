import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing behaviour", () => {
  test("typing a symptom and submitting carries the text to triage", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Describe how you feel").fill("Do din se pet mein jalan");
    await page.getByRole("button", { name: "Find the right specialist" }).click();
    await page.waitForURL(/\/app\/(triage|welcome)/);
    const intended = await page.evaluate(() => (history.state as { usr?: { from?: string } } | null)?.usr?.from);
    expect(intended ?? new URL(page.url()).pathname + new URL(page.url()).search).toContain("/app/triage?q=Do%20din%20se%20pet%20mein%20jalan");
  });

  test("the language picker sits at the top right and switches the whole page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const picker = page.locator("header select").first();
    const box = await picker.boundingBox();
    expect(box!.x).toBeGreaterThan(900);
    await picker.selectOption("mr");
    await expect(page.locator("html")).toHaveAttribute("lang", "mr");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("आधी");
    await picker.selectOption("hinglish");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("pehle");
  });

  test("the page ends with the logo and no closing quote", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).not.toContainText(/guidance, not/i);
    await expect(page.locator("footer").getByText("Healix")).toBeVisible();
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  });

  test("every picture in How it works stays inside its box on phones and desktops", async ({ page }) => {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflowing = await page.evaluate(() => {
        const bad: string[] = [];
        for (const node of document.querySelectorAll("#how-it-works ol > li > div:last-child *")) {
          const parent = node.parentElement;
          if (!parent || getComputedStyle(parent).display === "flex") continue;
          const a = node.getBoundingClientRect();
          const b = parent.getBoundingClientRect();
          if (a.width > 0 && (a.right > b.right + 1 || a.left < b.left - 1)) bad.push(node.textContent?.slice(0, 30) ?? "");
        }
        return bad;
      });
      expect(overflowing, `at ${width}px`).toEqual([]);
    }
  });

  test("the hero has no language buttons, no demo phrase and no tagline", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("group", { name: /language/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "मराठी" })).toHaveCount(0);
    await expect(page.getByText("AI patient navigation for India")).toHaveCount(0);
    await expect(page.getByPlaceholder("Tell Healix how you feel…")).toBeVisible();
    expect(await page.getByLabel("Describe how you feel").getAttribute("placeholder")).not.toMatch(/pet mein jalan/i);
    await expect(page.getByRole("banner").getByRole("link", { name: "Try the demo" })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: "Try the demo" })).toBeVisible();
  });

  test("the top strip, the picture under the hero, the trust line and the old sections are gone", async ({ page }) => {
    await page.goto("/");
    for (const text of [/KHOJ/i, "Responsible AI", /Feel unwell/, "Upload a report", "Answers grounded in", "Built for", "Token A-23"]) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
    await expect(page.locator("#responsible-ai")).toHaveCount(0);
  });

  test("the logo is large and the nav bar is tall, shrinking a little on scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const header = page.locator("header").first();
    expect((await header.boundingBox())?.height).toBe(88);
    const logo = page.getByRole("link", { name: "Healix home" }).first();
    expect((await logo.boundingBox())?.height).toBeGreaterThanOrEqual(36);
    await page.mouse.wheel(0, 200);
    await expect.poll(async () => (await header.boundingBox())?.height).toBe(72);
    const style = await header.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, blur: computed.backdropFilter };
    });
    expect(style.background).toBe("rgba(244, 242, 236, 0.88)");
    expect(style.blur).toContain("blur(8px)");
  });

  test("the live queue ticks", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toContainText("A-17");
    await page.clock.fastForward(5200);
    await expect(firstRow).toContainText("A-18");
  });

  test("every headline has exactly one italic word", async ({ page }) => {
    for (const language of ["en", "hi", "mr", "hinglish"]) {
      await page.goto(`/?lang=${language}`);
      await page.locator("h1").waitFor();
      const headings = page.locator("h1, main h2");
      const count = await headings.count();
      expect(count).toBeGreaterThanOrEqual(4);
      for (let index = 0; index < count; index += 1) {
        const italics = await headings.nth(index).locator("i").count();
        const text = (await headings.nth(index).innerText()).trim();
        expect(italics, `${language}: "${text}"`).toBe(1);
        const italicWords = (await headings.nth(index).locator("i").innerText()).trim().split(/\s+/);
        expect(italicWords, `${language}: "${text}" italic word`).toHaveLength(1);
      }
    }
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

test.describe("how it works and features", () => {
  test("walks through six steps with a picture for each", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#how-it-works");
    await expect(section.getByRole("heading", { level: 2 })).toContainText("clarity");
    await expect(section.locator("ol > li")).toHaveCount(6);
    for (const title of [
      "Tell Healix how you feel",
      "Watch it think, safely",
      "Choose a doctor and a time",
      "Get your token, leave at the right time",
      "Make sense of your reports",
      "Ask, and share with others",
    ]) {
      await expect(section.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(section.getByText("A-23")).toBeVisible();
  });

  test("the features section names every feature, including the community", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#features");
    for (const title of [
      "Symptom check",
      "Find and book a doctor",
      "Live token and queue",
      "Report reader",
      "Community",
      "Your language, your voice",
      "Family profiles",
      "Large-text mode",
      "Emergency help",
    ]) {
      await expect(section.getByRole("heading", { name: title })).toBeVisible();
    }
    await expect(section.getByRole("article")).toHaveCount(9);
  });

  test("the report assistant card describes the real behaviour in readable chat bubbles", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#features");
    await expect(card.getByRole("heading", { name: "Any doubt about your report, answered in plain words." })).toBeVisible();
    await expect(card.getByText("It only answers questions about your report, and nothing else.")).toBeVisible();
    await expect(card.getByText("HbA1c is your average blood sugar over about three months.", { exact: false })).toBeVisible();
    await expect(card.getByText("Lab values, in plain words")).toHaveCount(0);
    await expect(card.locator(".recharts-wrapper, [role=img][aria-label*='mg/dL']")).toHaveCount(0);
  });
});

test.describe("emergency button on the landing page", () => {
  test("is in the top bar, opens the public emergency page and needs no sign-in", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Emergency help" }).click();
    await expect(page).toHaveURL(/\/emergency$/);
    await expect(page.getByRole("link", { name: /Call 102/ })).toHaveAttribute("href", "tel:102");
    await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
    await expect(page.getByText("You are not signed in")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to alert the hospital with your details" })).toBeVisible();
    await page.getByRole("link", { name: "Back to the home page" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("stays visible on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: "Emergency help" })).toBeVisible();
  });
});

test.describe("responsive layout", () => {
  for (const width of [390, 768, 1024, 1440]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, lists the section links and the language, navigates and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (const name of ["How it works", "Features", "For hospitals"]) {
      await expect(dialog.getByRole("link", { name })).toBeVisible();
    }
    await expect(dialog.getByRole("link", { name: "Responsible AI" })).toHaveCount(0);
    await expect(dialog.getByLabel("Language")).toBeVisible();
    await dialog.getByRole("link", { name: "For hospitals" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#for-hospitals$/);
  });

  test("closes with Escape and returns focus to the menu button", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("is not shown on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });
});
