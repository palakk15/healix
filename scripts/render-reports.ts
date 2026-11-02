import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { fixtures, interpret, type FixtureKey } from "../server/mock/reports.ts";

const pageWidth = 794;
const pageHeight = 1123;
const preinstalledChromium = "/opt/pw-browsers/chromium";

function flagFor(value: number, low: number | null, high: number | null): string {
  const result = interpret(value, low, high);
  if (result === "normal") return "";
  return result === "low" ? "L" : "H";
}

function referenceText(low: number | null, high: number | null): string {
  if (low !== null && high !== null && low > 0) return `${low} – ${high}`;
  if (high !== null) return `< ${high}`;
  if (low !== null) return `> ${low}`;
  return "";
}

function reportHtml(key: FixtureKey): string {
  const fixture = fixtures[key];
  const rows = fixture.observations
    .map((entry) => {
      const flag = flagFor(entry.value, entry.low, entry.high);
      return `<tr>
        <td class="name">${entry.display}</td>
        <td class="value ${flag ? "flagged" : ""}"><span data-code="${entry.code}">${entry.value}</span></td>
        <td class="flag">${flag}</td>
        <td>${entry.unit}</td>
        <td class="reference">${referenceText(entry.low, entry.high)}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { width: ${pageWidth}px; height: ${pageHeight}px; background: #ffffff; font-family: Arial, Helvetica, sans-serif; color: #1c2430; padding: 56px 56px 40px; position: relative; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1f5f8b; padding-bottom: 16px; }
    .lab { font-size: 26px; font-weight: 700; color: #1f5f8b; letter-spacing: 0.2px; }
    .sub { font-size: 12px; color: #5b6573; margin-top: 4px; line-height: 1.5; }
    .badge { border: 1px solid #1f5f8b; color: #1f5f8b; font-size: 11px; padding: 6px 10px; letter-spacing: 1px; font-weight: 700; }
    .patient { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-top: 22px; font-size: 13px; padding: 14px 16px; background: #f3f6f9; }
    .patient b { display: inline-block; width: 112px; color: #5b6573; font-weight: 600; }
    h1 { font-size: 18px; margin: 30px 0 12px; text-transform: uppercase; letter-spacing: 1px; color: #1c2430; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5b6573; padding: 10px 8px; border-bottom: 2px solid #1c2430; }
    td { padding: 16px 8px; border-bottom: 1px solid #dde3ea; }
    td.name { font-weight: 600; width: 34%; }
    td.value { font-size: 17px; font-weight: 700; width: 16%; }
    td.value.flagged { color: #a8321f; }
    td.flag { width: 6%; font-weight: 700; color: #a8321f; }
    td.reference { color: #5b6573; }
    .note { margin-top: 28px; font-size: 11.5px; color: #5b6573; line-height: 1.6; }
    .foot { position: absolute; left: 56px; right: 56px; bottom: 40px; border-top: 1px solid #dde3ea; padding-top: 12px; font-size: 11px; color: #8a929d; display: flex; justify-content: space-between; }
  </style></head><body>
    <div class="head">
      <div><div class="lab">${fixture.labName}</div><div class="sub">Pune, Maharashtra · Sample layout</div></div>
      <div class="badge">SAMPLE REPORT</div>
    </div>
    <div class="patient">
      <div><b>Patient</b>Sunita Patil</div><div><b>Age / Sex</b>58 Y / Female</div>
      <div><b>Sample</b>Fasting, morning</div><div><b>Referred by</b>Self</div>
    </div>
    <h1>${fixture.reportType}</h1>
    <table>
      <thead><tr><th>Test</th><th>Result</th><th></th><th>Unit</th><th>Reference range</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">H = above reference range, L = below reference range. Reference ranges may vary between laboratories. This page is sample content created for a demonstration and is not a real medical record.</p>
    <div class="foot"><span>Generated for the Healix demo</span><span>Page 1 of 1</span></div>
  </body></html>`;
}

async function main(): Promise<void> {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputDirectory = resolve(root, "server/mock/data/reports");
  mkdirSync(outputDirectory, { recursive: true });

  const browser = await chromium.launch(existsSync(preinstalledChromium) ? { executablePath: preinstalledChromium } : {});
  const page = await browser.newPage({ viewport: { width: pageWidth, height: pageHeight } });
  const boxes: Record<string, Record<string, [number, number, number, number]>> = {};

  for (const key of Object.keys(fixtures) as FixtureKey[]) {
    await page.setContent(reportHtml(key));
    const measured = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-code]")].map((element) => {
        const rect = element.getBoundingClientRect();
        return { code: element.dataset.code ?? "", x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    boxes[key] = {};
    for (const item of measured) {
      const padding = 6;
      boxes[key][item.code] = [
        Math.max((item.x - padding) / pageWidth, 0),
        Math.max((item.y - padding) / pageHeight, 0),
        (item.width + padding * 2) / pageWidth,
        (item.height + padding * 2) / pageHeight,
      ].map((value) => Math.round(value * 10000) / 10000) as [number, number, number, number];
    }
    await page.screenshot({ path: resolve(outputDirectory, fixtures[key].imageFile) });
  }

  writeFileSync(resolve(root, "server/mock/data/report-boxes.json"), `${JSON.stringify(boxes, null, 2)}\n`);
  await browser.close();
  console.log(`rendered ${Object.keys(fixtures).length} report images with value bounding boxes`);
}

void main();
