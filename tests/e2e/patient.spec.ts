import { expect, test, type Page } from "@playwright/test";
import { english, expectNoSeriousViolations, goToSymptoms, hindi, holdPointer, marathi, onboard, resetWorld } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function switchTo(page: Page, name: string): Promise<void> {
  if (!/\/app\/?(\?|$)/.test(page.url())) await page.goto("/app?fast=1");
  await page.getByRole("button", { name: new RegExp(`^${name} ·`) }).click();
}

test.describe("onboarding", () => {
  test("a signed-out visitor to /app is sent to the welcome flow", async ({ page }) => {
    await page.goto("/app/triage");
    await expect(page).toHaveURL(/\/app\/welcome$/);
    await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
  });

  test("walks four steps, with nothing pre-ticked, and lands on home", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    await expect(page.getByRole("radio")).toHaveCount(4);
    for (const script of ["English", "हिन्दी", "मराठी", "Hinglish"]) await expect(page.getByRole("radio", { name: script })).toBeVisible();

    await page.getByRole("radio", { name: "English" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    await page.getByRole("textbox").fill("12345");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("alert")).toHaveText("Enter a 10-digit mobile number.");
    await page.getByRole("button", { name: "Use the demo account" }).click();
    await expect(page.getByText("Demo mode: the code is 123456.")).toBeVisible();

    await page.getByRole("textbox").fill("000000");
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("alert")).toHaveText("That code is not correct. Please try again.");
    await page.getByRole("textbox").fill("123456");
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) await expect(switches.nth(index)).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
    await expect(page.getByText("Switch on at least one to continue.")).toBeVisible();
    await page.getByRole("switch", { name: "Understand my symptoms" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    await expect(page.getByRole("region", { name: "Your details" }).getByLabel("Full name")).toHaveValue("Sunita Patil");
    await expect(page.getByText("Shanta Joshi")).toBeVisible();
    await page.getByRole("button", { name: "Add a family member" }).click();
    await page.getByRole("dialog").getByLabel("Full name").fill("Baba Patil");
    await page.getByRole("dialog").getByLabel("Relation").selectOption("father");
    await page.getByRole("dialog").getByLabel("Age", { exact: true }).fill("85");
    await page.getByRole("dialog").getByRole("button", { name: "Add member" }).click();
    await expect(page.getByRole("region", { name: "Family members" }).getByText("Baba Patil")).toBeVisible();
    await page.getByRole("button", { name: "Start using Healix" }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Sunita");
    await expect(page.getByRole("group", { name: "Profiles" }).getByRole("button")).toHaveCount(3);
  });

  test("an unknown phone number is registered after a correct code", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox").fill("9123456789");
    await page.getByRole("button", { name: "Send code" }).click();
    await page.getByRole("textbox").fill("123456");
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    await page.getByRole("switch", { name: "Understand my symptoms" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("region", { name: "Your details" }).getByLabel("Full name")).toHaveValue("New patient");
  });

  test("Devanagari text gets the extra four pixels of line height", async ({ page }) => {
    await page.goto("/app");
    const lineHeight = () => page.getByRole("heading", { level: 1 }).evaluate((element) => parseFloat(getComputedStyle(element).lineHeight));
    const latin = await lineHeight();
    await page.getByRole("radio", { name: "मराठी" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("तुमची भाषा निवडा");
    expect(await lineHeight()).toBe(latin + 4);
  });

  test("the language choice switches the whole flow immediately", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("radio", { name: "मराठी" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("तुमची भाषा निवडा");
    await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  });
});

test.describe("staying signed in", () => {
  test("a reload keeps the session, the profile and elder mode, and stores no health details", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await switchTo(page, "Shanta");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Shanta");
    await expect(page.getByRole("button", { name: /^Shanta ·/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");

    const stored = await page.evaluate(() => ({ session: window.sessionStorage.getItem("healix.session"), local: JSON.stringify({ ...window.localStorage }) }));
    expect(JSON.parse(stored.session ?? "{}").state).toEqual({ accessToken: "mock.pat_sunita", activeProfileId: "prof_aai" });
    expect(stored.session).not.toMatch(/Hypertension|diabetes|conditions/i);
    expect(stored.local).not.toMatch(/mock\.pat|Hypertension|diabetes|accessToken/i);
  });

  test("a reload on a deep link stays on that screen", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await page.reload();
    await expect(page).toHaveURL(/\/app\/triage$/);
    await expect(page.getByRole("textbox", { name: "Describe your symptoms" })).toBeVisible();
  });

  test("a token the server no longer accepts sends the person back to onboarding", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await page.evaluate(() => window.sessionStorage.setItem("healix.session", JSON.stringify({ state: { accessToken: "mock.nobody", activeProfileId: "x" }, version: 0 })));
    await page.reload();
    await expect(page).toHaveURL(/\/app\/welcome$/);
    await expect(page.getByRole("heading", { name: "Choose your language" })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(window.sessionStorage.getItem("healix.session") ?? "{}").state.accessToken)).toBeNull();
  });

  test("a new tab starts signed out, because the token lives only in this tab", async ({ page, context }) => {
    await page.goto("/app");
    await onboard(page);
    const other = await context.newPage();
    await other.goto("/app");
    await expect(other).toHaveURL(/\/app\/welcome$/);
  });
});

test.describe("demo step 1: symptoms in Marathi", () => {
  test("landing mic, onboarding, then triage with the text prefilled and the reasoning trail", async ({ page }) => {
    await page.goto("/");
    await page.locator("header select").first().selectOption("mr");
    await page.getByRole("button", { name: "बोलून सांगा" }).click();
    await page.getByRole("button", { name: "परवानगी द्या आणि पुढे जा" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "रेकॉर्डिंग थांबवा" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून");
    await page.getByRole("button", { name: "योग्य तज्ज्ञ शोधा" }).click();

    await expect(page).toHaveURL(/\/app\/welcome$/);
    await onboard(page, marathi);

    await expect(page).toHaveURL(/\/app\/triage\?q=/);
    const box = page.getByRole("textbox", { name: "तुमची लक्षणे सांगा" });
    await expect(box).toHaveValue("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून");
    await page.getByRole("button", { name: "पाठवा" }).click();

    await expect(page.getByRole("status", { name: "Healix तपासत आहे…" })).toBeVisible();
    const steps = page.locator("ol li");
    await expect(steps.first()).toBeVisible();
    await expect(steps).toHaveCount(3, { timeout: 5000 });
    await expect(page.locator('[data-urgency="soon"]')).toContainText("2 दिवसांत");
    await expect(page.getByText("गॅस्ट्रोएन्टेरोलॉजिस्ट: पोट आणि पचनाचे तज्ज्ञ")).toBeVisible();
    await expect(page.getByText("अशा लक्षणांची तपासणी सहसा पोट आणि पचनाचे तज्ज्ञ करतात")).toBeVisible();
    await expect(page.getByText("हे मार्गदर्शन आहे, निदान नाही.")).toBeVisible();
    const link = page.getByRole("link", { name: "माझ्या जवळचे डॉक्टर दाखवा" });
    await expect(link).toHaveAttribute("href", /specialty=Gastroenterology&urgency=soon/);
  });

  test.describe("with motion allowed", () => {
    test.use({ reducedMotion: "no-preference" });

  test("the reasoning steps appear one at a time, about 250 ms apart", async ({ page }) => {
    await page.goto("/app");
    await onboard(page, english, { consents: [0] });
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Knee pain when climbing stairs for 2 weeks");
    await page.evaluate(() => {
      const trail: Array<{ n: number; t: number }> = [];
      (window as unknown as { __trail: typeof trail }).__trail = trail;
      new MutationObserver(() => {
        const n = document.querySelectorAll("ol li").length;
        if (trail.at(-1)?.n !== n) trail.push({ n, t: performance.now() });
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("ol li")).toHaveCount(3, { timeout: 8000 });
    const timeline = await page.evaluate(() => (window as unknown as { __trail: Array<{ n: number; t: number }> }).__trail);
    const counts = timeline.filter((entry) => entry.n > 0).map((entry) => entry.n);
    expect(counts).toEqual([1, 2, 3]);
    const gaps = timeline.filter((entry) => entry.n > 0).slice(1).map((entry, index, list) => entry.t - (index === 0 ? (timeline.find((first) => first.n === 1)?.t ?? 0) : (list[index - 1]?.t ?? 0)));
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(200);
      expect(gap).toBeLessThanOrEqual(450);
    }
    await expect(page.locator('[data-urgency="routine"]')).toBeVisible();
    await expect(page.getByText("Orthopedic doctor: bone and joint specialist")).toBeVisible();
  });
  });
});

test.describe("emergency", () => {
  test("demo step 6: a red flag replaces everything with the emergency screen", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("chest pain and sweating");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    const screen = page.getByTestId("emergency-screen");
    await expect(screen).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get emergency help now");
    await expect(page.getByRole("link", { name: "Call 102 now" })).toHaveAttribute("href", "tel:102");
    await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
    await expect(page.getByText("Why: Chest pain with sweating")).toBeVisible();
    await expect(page.getByText("Karve Road Care Clinic")).toBeVisible();
    await expect(page.getByText(/2\.1 km away/)).toBeVisible();

    await expect(page.getByRole("link", { name: /doctors near me/i })).toHaveCount(0);
    await expect(page.locator("[data-app-shell]")).toHaveAttribute("inert", "");
    await expect(screen).toHaveAttribute("aria-modal", "true");
    expect(await page.locator("[data-app-shell] nav a").first().evaluate((link) => link.closest("[inert]") !== null)).toBe(true);
    await expect(page.locator('[data-urgency]')).toHaveCount(0);
  });

  test("holding for two seconds shares the alert; releasing early does not", async ({ page, request }) => {
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("chest pain and sweating");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const hold = page.getByTestId("hold-button");

    await holdPointer(page, hold, 900);
    await expect(page.getByText("Sent to Karve Road Care Clinic")).toHaveCount(0);

    await holdPointer(page, hold, 2400);
    await expect(page.getByText("Sent to Karve Road Care Clinic")).toBeVisible();
    await expect(page.getByText(/Estimated arrival in about \d+ min/)).toBeVisible();
    await expect(page.getByText("Location is off, so your saved area was used.")).toBeVisible();

    const login = await request.post("/api/auth/login", { data: { phone: "9000000001", otp: "123456" } });
    const { access_token: token } = (await login.json()) as { access_token: string };
    const alerts = (await (await request.get("/api/dashboard/pre-alerts", { headers: { authorization: `Bearer ${token}` } })).json()) as {
      alerts: Array<{ patient_label: string; summary: string }>;
    };
    expect(alerts.alerts).toHaveLength(1);
    expect(alerts.alerts[0]?.patient_label).toBe("Sunita Patil");
    expect(alerts.alerts[0]?.summary).toContain("chest pain and sweating");
  });

  test("the infant fever phrase in Hindi is an emergency too", async ({ page }) => {
    await page.goto("/app");
    await onboard(page, hindi);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "अपने लक्षण बताएँ" }).fill("बच्चे को तेज बुखार है, 2 महीने का है");
    await page.getByRole("button", { name: "भेजें" }).click();
    await expect(page.getByRole("link", { name: "अभी 102 पर कॉल करें" })).toHaveAttribute("href", "tel:102");
    await expect(page.getByText("3 महीने से छोटे बच्चे में बुखार").first()).toBeVisible();
  });

  test("the SOS bar on home needs a two second hold, then opens the SOS page and sends", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    const sos = page.getByTestId("hold-button");
    await holdPointer(page, sos, 1000);
    await expect(page).toHaveURL(/\/app$/);

    await holdPointer(page, sos, 2400);
    await expect(page).toHaveURL(/\/app\/emergency\?sos=1/);
    await expect(page.getByText("Sent to Karve Road Care Clinic")).toBeVisible();
  });
});

test.describe("follow-up questions", () => {
  test("a calm answer settles on a general physician; a sudden one becomes an emergency", async ({ page }) => {
    await page.goto("/app");
    await onboard(page, hindi);
    const phrase = "मुझे दो दिन से सिर में बहुत दर्द है";

    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "अपने लक्षण बताएँ" }).fill(phrase);
    await page.getByRole("button", { name: "भेजें" }).click();
    await expect(page.getByText("क्या सिरदर्द अचानक शुरू हुआ और अब तक का सबसे तेज़ लग रहा है?")).toBeVisible();
    await page.getByRole("button", { name: "नहीं, धीरे-धीरे बढ़ा" }).click();
    await expect(page.getByText("सामान्य चिकित्सक: आम बीमारियों के डॉक्टर")).toBeVisible();
    await expect(page.locator('[data-urgency="soon"]')).toBeVisible();

    await page.getByRole("button", { name: "फिर से शुरू करें" }).click();
    await page.getByRole("textbox", { name: "अपने लक्षण बताएँ" }).fill(phrase);
    await page.getByRole("button", { name: "भेजें" }).click();
    await page.getByRole("button", { name: "हाँ, अचानक" }).click();
    await expect(page.getByRole("link", { name: "अभी 102 पर कॉल करें" })).toBeVisible();
  });
});

test.describe("triage inputs", () => {
  test("shows a calm skeleton while waiting, then the result", async ({ page }) => {
    await page.route("**/api/ai/triage", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("status", { name: "Healix is checking…" })).toBeVisible();
    await expect(page.getByText("Checking for danger signs first…")).toBeVisible();
    await expect(page.locator('[data-urgency="soon"]')).toBeVisible({ timeout: 5000 });
  });

  test("body map regions and the pain scale add to what is sent", async ({ page }) => {
    let sentText = "";
    await page.route("**/api/ai/triage", async (route) => {
      sentText = (route.request().postDataJSON() as { text: string }).text;
      await route.continue();
    });
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);

    await page.getByText("Where does it hurt?").first().click();
    await page.getByRole("button", { name: "Stomach" }).click();
    await expect(page.getByRole("button", { name: "Remove Stomach" })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lower back" })).toBeVisible();
    await page.getByRole("button", { name: "Front", exact: true }).click();
    await page.getByRole("button", { name: "Chest" }).click();
    await page.getByRole("radio", { name: /3: Moderate/ }).click();
    await expect(page.getByRole("radio", { name: /3: Moderate/ })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Remove Chest" }).click();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator('[data-urgency]')).toBeVisible({ timeout: 5000 });
    expect(sentText).toBe("Pain area: Stomach. Pain strength: 3 out of 5.");
  });

  test("a failure shows a calm message with a way to retry", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/ai/triage", async (route) => {
      calls += 1;
      if (calls === 1) await route.fulfill({ status: 503, json: { error: { code: "ai_down", message: "x", retry: true } } });
      else await route.continue();
    });
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Knee pain when climbing stairs for 2 weeks");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("We could not check this right now");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator('[data-urgency="routine"]')).toBeVisible();
    expect(calls).toBe(2);
  });

  test("send is disabled until there is something to send", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await goToSymptoms(page);
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("pet dard");
    await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  });

  test("the home mic sends a spoken phrase to triage", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page).toHaveURL(/\/app\/triage\?q=/);
    await expect(page.getByRole("textbox", { name: "Describe your symptoms" })).toHaveValue(/knee|Knee|chest|Do din|सिर|जेवल/i);
  });
});

test.describe("home", () => {
  test("switching to Aai turns on elder mode and the simpler home", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await expect(page.getByRole("link", { name: /Find a doctor/ })).toBeVisible();

    await switchTo(page, "Shanta");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");
    await expect(page.getByRole("link", { name: /Find a doctor/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /My reports/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Healix AI/ }).first()).toBeVisible();
    await expect(page.getByTestId("hold-button")).toBeVisible();

    await switchTo(page, "Sunita");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "false");
    await expect(page.getByRole("link", { name: /Find a doctor/ })).toBeVisible();
  });

  test("elder mode makes the type 25% larger", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Sunita");
    const size = () => page.getByRole("heading", { level: 1 }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    const normal = await size();
    await switchTo(page, "Shanta");
    const elder = await size();
    expect(elder / normal).toBeCloseTo(1.25, 2);
  });

  test("the bottom tab bar has the five tabs", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    const bar = page.getByRole("navigation", { name: "Primary" });
    for (const name of ["Home", "Symptoms", "Reports", "Token", "Healix AI"]) await expect(bar.getByRole("link", { name })).toBeVisible();
  });
});

test.describe("accessibility and layout", () => {
  test("welcome, home, triage and the emergency screen have no serious violations", async ({ page }) => {
    await page.goto("/app");
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Use the demo account" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expectNoSeriousViolations(page);
    for (const name of english.consents) await page.getByRole("switch", { name }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Start using Healix" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Sunita");
    await expectNoSeriousViolations(page);

    await goToSymptoms(page);
    await page.getByText("Where does it hurt?").first().click();
    await expectNoSeriousViolations(page);
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator('[data-urgency="soon"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator("ol li")).toHaveCount(3, { timeout: 3000 });
    await expectNoSeriousViolations(page);

    await page.getByRole("button", { name: "Start over" }).click();
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("chest pain and sweating");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByTestId("emergency-screen")).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  test("no horizontal scroll on the patient screens at phone and desktop widths", async ({ page }) => {
    await page.goto("/app");
    await onboard(page);
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ["Home", "Symptoms"]) {
        await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: tab }).click();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${tab} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("the patient app stays in a centred 480px column on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app");
    await onboard(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Namaste, Sunita");
    const column = page.locator("main").first();
    const box = await column.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(480);
    expect((box?.x ?? 0) + (box?.width ?? 0) / 2).toBeCloseTo(720, -1);
  });
});
