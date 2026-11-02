import { expect, test, type Page } from "@playwright/test";
import { resetWorld } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetWorld(request);
});

const consentLine = "Your voice is sent to Sarvam AI to turn it into text.";

async function record(page: Page, name = /speak your symptoms/i) {
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Allow and continue" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Stop recording" }).click();
}

test.describe("voice on the landing page (offline demo mode)", () => {
  test("demo step 1: Marathi mic fills the input with the scripted phrase", async ({ page }) => {
    await page.goto("/");
    await page.locator("header select").first().selectOption("mr");
    await page.getByRole("button", { name: "बोलून सांगा" }).click();

    await expect(page.getByRole("dialog")).toContainText("तुमचा आवाज मजकुरात बदलण्यासाठी Sarvam AI कडे पाठवला जातो.");
    await page.getByRole("button", { name: "परवानगी द्या आणि पुढे जा" }).click();
    await expect(page.getByRole("button", { name: "रेकॉर्डिंग थांबवा" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "रेकॉर्डिंग थांबवा" }).click();

    await expect(page.getByRole("textbox")).toHaveValue("जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून");
    await expect(page.getByText("ऐकले: जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून")).toBeVisible();
    await expect(page.getByText(/Switch Healix|बदलायचे/)).toHaveCount(0);
  });

  test("shows the consent line once, then records without asking again", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await expect(page.getByRole("dialog")).toContainText(consentLine);
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("Knee pain when climbing stairs for 2 weeks");

    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("textbox")).toHaveValue("chest pain and sweating");
  });

  test("a voice transcript can be submitted straight to triage", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("textbox")).not.toHaveValue("");
    await page.getByRole("button", { name: "Find the right specialist" }).click();
    await page.waitForURL(/\/app\/(triage|welcome)/);
    const intended = await page.evaluate(() => (history.state as { usr?: { from?: string } } | null)?.usr?.from);
    expect(intended ?? page.url()).toContain("/app/triage?q=Knee%20pain");
  });

  test("uploads real 16 kHz mono WAV audio with the language and purpose", async ({ page }) => {
    let upload: Buffer | null = null;
    await page.route("**/api/sarvam/stt", async (route) => {
      upload = route.request().postDataBuffer();
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("textbox")).not.toHaveValue("");

    expect(upload).not.toBeNull();
    const body = upload as unknown as Buffer;
    const riff = body.indexOf("RIFF");
    expect(riff).toBeGreaterThan(0);
    expect(body.subarray(riff + 8, riff + 12).toString()).toBe("WAVE");
    expect(body.readUInt16LE(riff + 22)).toBe(1);
    expect(body.readUInt32LE(riff + 24)).toBe(16000);
    expect(body.readUInt16LE(riff + 34)).toBe(16);
    const text = body.toString("latin1");
    expect(text).toContain('name="language"');
    expect(text).toContain('name="purpose"');
    expect(text).toContain("symptoms");
  });

  test("the level ring appears while recording and Escape cancels", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByTestId("voice-level-ring")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /speak your symptoms/i })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("");
  });

  test("a blocked microphone gives a calm message and typing still works", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    });
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await expect(page.getByText("Microphone access is blocked. You can type instead.")).toBeVisible();
    await page.getByRole("textbox").fill("pet mein jalan");
    await expect(page.getByRole("textbox")).toHaveValue("pet mein jalan");
  });

  test("typing in another language offers a gentle switch", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox").fill("मला पोटात दुखत आहे");
    await expect(page.getByText("You typed in मराठी. Switch Healix to मराठी?")).toBeVisible();
    await page.getByRole("button", { name: "Switch", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "mr");
  });
});

test.describe("voice with Sarvam answers", () => {
  test("a Marathi transcript on an English page offers to switch language", async ({ page }) => {
    await page.route("**/api/meta", (route) =>
      route.fulfill({ json: { data_mode: "live", sarvam_enabled: true, sarvam_mode: "live" } }),
    );
    await page.route("**/api/sarvam/stt", (route) =>
      route.fulfill({ json: { transcript: "मला पोटात दुखत आहे", language: "mr", source: "sarvam" } }),
    );
    await page.goto("/");
    await record(page);
    await expect(page.getByRole("textbox")).toHaveValue("मला पोटात दुखत आहे");
    await expect(page.getByText("You typed in मराठी. Switch Healix to मराठी?")).toBeVisible();
  });

  test("a Sarvam failure shows a calm message", async ({ page }) => {
    await page.route("**/api/sarvam/stt", (route) =>
      route.fulfill({ status: 504, json: { error: { code: "sarvam_timeout", message: "slow", retry: true } } }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: /speak your symptoms/i }).click();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByText("Voice is not working right now. You can type instead.")).toBeVisible();
    await expect(page.getByRole("button", { name: /speak your symptoms/i })).toBeVisible();
  });

  test("the mic is hidden when the server has no voice", async ({ page }) => {
    await page.route("**/api/meta", (route) =>
      route.fulfill({ json: { data_mode: "live", sarvam_enabled: false, sarvam_mode: "off" } }),
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Find the right specialist" })).toBeVisible();
    await expect(page.getByRole("button", { name: /speak your symptoms/i })).toHaveCount(0);
  });
});
