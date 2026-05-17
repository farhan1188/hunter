// Intercept remotejobsfinder.co network requests during the recommendations
// page load — the React app fetches the job data from a JSON API.

import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

import { chromium } from "playwright-core";

async function main() {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://localhost:9222");
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();

  const apiCalls: Array<{ url: string; method: string; status: number; ct: string; bodyPreview: string }> = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("remotejobsfinder.co") && !url.includes("/api/")) return;
    const ct = res.headers()["content-type"] ?? "";
    if (!/json|graphql/.test(ct)) return;
    try {
      const text = await res.text();
      apiCalls.push({
        url,
        method: res.request().method(),
        status: res.status(),
        ct,
        bodyPreview: text.slice(0, 400),
      });
    } catch { /* ignore */ }
  });

  await page.goto("https://remotejobsfinder.co/en/platform/recommended", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  // Trigger card hover/click to surface detail-fetch API call
  await page.locator("div.cursor-pointer").first().click().catch(() => {});
  await page.waitForTimeout(3000);

  console.log(`Captured ${apiCalls.length} JSON responses from remotejobsfinder.co:`);
  for (const c of apiCalls) {
    console.log(`\n  ${c.method} ${c.status} ${c.url}`);
    console.log(`  body: ${c.bodyPreview.replace(/\s+/g, " ").slice(0, 400)}`);
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
