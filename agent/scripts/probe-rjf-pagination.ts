import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

import { chromium } from "playwright-core";

async function main() {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://localhost:9222");
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();
  let pages = 0;
  let totalJobs = 0;
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("/jobs/recommended") || u.includes("/jobs/search") || u.includes("/jobs?")) {
      try {
        const j = await res.json();
        if (j && j.data && Array.isArray(j.data)) {
          pages++;
          totalJobs += j.data.length;
          console.log(`Page ${pages} | url=${u}`);
          console.log(`  jobs=${j.data.length}, total=${totalJobs}`);
          if (j.meta || j.pagination) console.log("  meta:", JSON.stringify(j.meta || j.pagination).slice(0, 300));
          if (j.totalElements) console.log("  totalElements:", j.totalElements);
        }
      } catch { /* ignore */ }
    }
  });
  await page.goto("https://remotejobsfinder.co/en/platform/recommended", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // Scroll several times to trigger pagination
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 8000);
    await page.waitForTimeout(1200);
  }
  console.log(`Done. ${pages} response(s), ${totalJobs} jobs total.`);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
