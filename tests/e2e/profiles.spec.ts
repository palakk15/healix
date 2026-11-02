import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousViolations, english, resetWorld, startDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

async function toProfileStep(page: Page) {
  await page.goto("/?fast=1");
  await page.getByRole("main").getByRole("link", { name: "Try the demo" }).click();
  await page.getByRole("radio", { name: english.language }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await page.getByRole("button", { name: english.demo }).click();
  await page.getByRole("button", { name: english.confirm }).click();
  for (const label of english.consents) await page.getByRole("switch", { name: label }).click();
  await page.getByRole("button", { name: english.cont }).click();
  await expect(page.getByRole("heading", { name: "Who is this for?" })).toBeVisible();
}

async function addMember(page: Page, values: { name: string; age: string; relation?: string; sex?: string; conditions?: string[]; elder?: boolean }) {
  await page.getByRole("button", { name: "Add a family member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(values.name);
  if (values.relation) await dialog.getByLabel("Relation").selectOption(values.relation);
  await dialog.getByLabel("Age", { exact: true }).fill(values.age);
  if (values.sex) await dialog.getByLabel("Sex").selectOption(values.sex);
  for (const condition of values.conditions ?? []) await dialog.getByRole("button", { name: condition }).click();
  if (values.elder) await dialog.getByRole("switch", { name: "Larger text and simpler screens" }).click();
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toBeHidden();
}

async function switchTo(page: Page, name: string): Promise<void> {
  if (!/\/app\/?(\?|$)/.test(page.url())) await page.goto("/app?fast=1");
  await page.getByRole("button", { name: new RegExp(`^${name} ·`) }).click();
}

test.describe("sign-up steps 3 and 4", () => {
  test("the larger text switch changes the screen at once, before saving", async ({ page }) => {
    await toProfileStep(page);
    const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main p.type-body") as Element).fontSize));
    const before = await size();
    await page.getByRole("switch", { name: "Larger text and simpler screens" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");
    expect(await size()).toBeGreaterThan(before * 1.2);
    await page.getByRole("switch", { name: "Larger text and simpler screens" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-elder", "false");
  });

  test("step 3 lists the four permissions and has no description under Listen and speak", async ({ page }) => {
    await page.goto("/?fast=1");
    await page.getByRole("main").getByRole("link", { name: "Try the demo" }).click();
    await page.getByRole("radio", { name: english.language }).click();
    await page.getByRole("button", { name: english.cont }).click();
    await page.getByRole("button", { name: english.demo }).click();
    await page.getByRole("button", { name: english.confirm }).click();
    const voice = page.getByRole("heading", { name: "Listen and speak" });
    await expect(voice).toBeVisible();
    await expect(page.getByText("Your voice is sent to Sarvam AI to turn it into text, and text is read aloud.")).toHaveCount(0);
    await expect(voice.locator("xpath=..").locator("p")).toHaveCount(0);
    await expect(page.getByText("Healix reads what you describe to suggest a specialist.")).toBeVisible();
    await expect(page.getByText("Healix reads your lab reports to explain them in simple words.")).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(4);
  });

  test("step 4 shows your own details first, then a small add button for family members", async ({ page }) => {
    await toProfileStep(page);
    const mine = page.getByRole("region", { name: "Your details" });
    await expect(mine.getByLabel("Full name")).toHaveValue("Sunita Patil");
    await expect(mine.getByLabel("Age", { exact: true })).toHaveValue("58");
    await expect(mine.getByLabel("Sex")).toHaveValue("female");
    await expect(mine.getByRole("button", { name: "Diabetes" })).toHaveAttribute("aria-pressed", "true");
    await expect(mine.getByRole("button", { name: "Heart disease" })).toHaveAttribute("aria-pressed", "false");
    const add = page.getByRole("button", { name: "Add a family member" });
    expect((await add.boundingBox())!.width).toBeLessThanOrEqual(48);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("saving your details updates them across the app", async ({ page }) => {
    await toProfileStep(page);
    const mine = page.getByRole("region", { name: "Your details" });
    await mine.getByLabel("Age", { exact: true }).fill("59");
    await mine.getByRole("button", { name: "Heart disease" }).click();
    await mine.getByRole("button", { name: "Save my details" }).click();
    await expect(mine.getByText("Details saved")).toBeVisible();
    await page.getByRole("button", { name: english.finish }).click();
    await page.goto("/app/settings?fast=1");
    const family = page.getByRole("region", { name: "Family profiles" });
    await expect(family.getByText(/59 years · Type 2 diabetes, Heart disease/)).toBeVisible();
  });

  test("the plus button opens a form with every detail, validates it and adds the person", async ({ page }) => {
    await toProfileStep(page);
    await page.getByRole("button", { name: "Add a family member" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add a family member" })).toBeVisible();
    for (const label of ["Full name", "Relation", "Age", "Sex", "Preferred language"]) await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "Health conditions" })).toBeVisible();
    await expect(dialog.getByRole("switch", { name: "Larger text and simpler screens" })).toBeVisible();

    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Please enter a name.");
    await dialog.getByLabel("Full name").fill("Ramesh Patil");
    await dialog.getByLabel("Age", { exact: true }).fill("200");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Enter an age between 0 and 120.");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await addMember(page, { name: "Ramesh Patil", age: "74", relation: "father", sex: "male", conditions: ["High blood pressure"], elder: true });
    const list = page.getByRole("region", { name: "Family members" });
    await expect(list.getByText("Ramesh Patil")).toBeVisible();
    await expect(list.getByText("74 years")).toBeVisible();
    await expect(list.getByText("Father")).toBeVisible();
  });

  test("has no serious violations with the dialog open", async ({ page }) => {
    await toProfileStep(page);
    await expectNoSeriousViolations(page);
    await page.getByRole("button", { name: "Add a family member" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSeriousViolations(page);
  });
});

test.describe("switching between people", () => {
  async function withRamesh(page: Page) {
    await toProfileStep(page);
    await addMember(page, { name: "Ramesh Patil", age: "74", relation: "father", sex: "male", conditions: ["High blood pressure"], elder: true });
    await page.getByRole("button", { name: english.finish }).click();
    await expect(page.getByTestId("profile-bar")).toBeVisible();
  }

  test("a bar on every screen shows whose care you are managing, and Home lets you switch", async ({ page }) => {
    await withRamesh(page);
    const bar = page.getByTestId("profile-bar");
    await expect(page.getByTestId("profile-bar-name")).toHaveText("Sunita");
    await expect(bar).toContainText("58 years");
    await switchTo(page, "Ramesh");
    await expect(page.getByTestId("profile-bar-name")).toHaveText("Ramesh");
    await expect(bar).toContainText("74 years");
    for (const path of ["/app", "/app/reports", "/app/triage", "/app/community", "/app/settings"]) {
      await page.goto(`${path}?fast=1`);
      await expect(page.getByTestId("profile-bar-name")).toHaveText("Ramesh");
    }
  });

  test("the new person's name, reports, tokens and details follow the switch everywhere", async ({ page }) => {
    await withRamesh(page);
    await expect(page.getByRole("heading", { name: "Namaste, Sunita" })).toBeVisible();
    await switchTo(page, "Ramesh");
    await expect(page.getByRole("heading", { name: "Namaste, Ramesh" })).toBeVisible();

    await page.locator('nav a[href="/app/reports"]').click();
    await expect(page.getByText("For Ramesh Patil")).toBeVisible();
    await expect(page.getByText("No reports yet")).toBeVisible();

    await switchTo(page, "Sunita");
    await page.locator('nav a[href="/app/reports"]').click();
    await expect(page.getByText("For Sunita Patil")).toBeVisible();
    await expect(page.getByRole("list", { name: "My reports" }).getByRole("listitem")).toHaveCount(2);
  });

  test("triage sends the active person's age and conditions", async ({ page }) => {
    await withRamesh(page);
    await switchTo(page, "Ramesh");
    let body: { age?: number; sex?: string; conditions?: string[] } = {};
    await page.route("**/api/ai/triage", async (route) => {
      body = route.request().postDataJSON() as typeof body;
      await route.continue();
    });
    await page.locator('nav a[href="/app/triage"]').click();
    await page.getByRole("textbox", { name: "Describe your symptoms" }).fill("Do din se pet mein jalan ho rahi hai");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("link", { name: "Show doctors near me" })).toBeVisible();
    expect(body.age).toBe(74);
    expect(body.sex).toBe("male");
    expect(body.conditions).toEqual(["Hypertension"]);
  });

  test("booking and the emergency screen show the person you switched to", async ({ page }) => {
    await withRamesh(page);
    await switchTo(page, "Ramesh");
    await page.goto("/app/emergency?fast=1");
    await expect(page.getByTestId("share-list")).toContainText("Name: Ramesh Patil");
    await expect(page.getByTestId("share-list")).toContainText("Age: 74");
    await page.goto("/app/doctors/doc_meera?fast=1");
    await expect(page.getByText("Booking for Ramesh Patil")).toBeVisible();
  });

  test("large text follows the person, and the choice survives a reload", async ({ page }) => {
    await withRamesh(page);
    await expect(page.locator("html")).toHaveAttribute("data-elder", "false");
    await switchTo(page, "Ramesh");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "true");
    await page.reload();
    await expect(page.getByTestId("profile-bar-name")).toHaveText("Ramesh");
    await switchTo(page, "Sunita");
    await expect(page.locator("html")).toHaveAttribute("data-elder", "false");
  });

  test("a person added later in Settings shows up in the bar at once, and can be edited", async ({ page }) => {
    await startDemo(page);
    await page.goto("/app/settings?fast=1");
    await page.getByRole("button", { name: "Add a family member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full name").fill("Anaya Patil");
    await dialog.getByLabel("Relation").selectOption("child");
    await dialog.getByLabel("Age", { exact: true }).fill("9");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await page.goto("/app?fast=1");
    await expect(page.getByRole("button", { name: /^Anaya ·/ })).toBeVisible();
    await page.goto("/app/settings?fast=1");

    await page.getByRole("button", { name: "Edit Anaya Patil" }).click();
    await page.getByRole("dialog").getByLabel("Age", { exact: true }).fill("10");
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("region", { name: "Family profiles" }).getByText("10 years")).toBeVisible();
    await switchTo(page, "Anaya");
    await expect(page.getByTestId("profile-bar")).toContainText("10 years");
  });

  test("the top bar offers no switching buttons", async ({ page }) => {
    await withRamesh(page);
    await expect(page.getByTestId("profile-bar").getByRole("button")).toHaveCount(0);
  });
});
