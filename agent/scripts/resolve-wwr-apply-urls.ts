// WeWorkRemotely listing URLs get patched into real ATS / company apply URLs
// using the authenticated Chrome session on port 9222. Without login, WWR
// shows an apply-btn--locked teaser; logged in, the button reveals the
// company's actual application page.
//
// Lives under agent/ so it can import playwright-core from agent/node_modules.
// DB client is imported via @hub/ alias.

import * as path from "node:path";
import * as dotenv from "dotenv";
// Agent runs under agent/ but the DB credentials live in the root .env.
// Load both: agent's own first, then root as a fallback.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
import { getDb } from "@hub/db/client";
import { chromium } from "playwright-core";

const CDP_URL = process.env.CDP_URL || "http://localhost:9222";

async function main() {
  const dry = process.argv.includes("--dry");
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, j.id AS job_id, j.apply_url, j.title, j.company_name " +
    "FROM applications a JOIN jobs j ON j.id = a.job_id " +
    "WHERE a.state IN ('qualified','ready','quality_review') " +
    "  AND j.apply_url LIKE '%weworkremotely.com/remote-jobs/%'",
  );
  console.log(`Resolving ${rows.length} WWR listings via Chrome CDP at ${CDP_URL}...\n`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0] ?? (await browser.newContext());

  let resolved = 0;
  let failed = 0;
  for (const r of rows) {
    const oldUrl = r.apply_url as string;
    const page = await ctx.newPage();
    try {
      await page.goto(oldUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

      const candidates = [
        'a.listing-apply-cta__btn[href]:not([href*="weworkremotely.com"])',
        'a.apply-btn[href]:not([href*="weworkremotely.com"]):not([href="#"])',
        'a[href*="boards.greenhouse.io"]',
        'a[href*="job-boards.greenhouse.io"]',
        'a[href*="jobs.lever.co"]',
        'a[href*="ashbyhq.com"]',
        'a[href*="apply.workable.com"]',
        'a[href*="jobs.workable.com"]',
        'a[href*="myworkdayjobs.com"]',
        'a[href*="smartrecruiters.com"]',
        'a[href*="bamboohr.com"]',
        'a[href*="recruitee.com"]',
        'a[href*="breezy.hr"]',
        'a:has-text("Apply for this position"):not([href="#"])',
        'a:has-text("Apply Now"):not([href="#"])',
      ];

      let resolvedUrl: string | null = null;
      for (const sel of candidates) {
        const link = page.locator(sel).first();
        if ((await link.count()) === 0) continue;
        const href = await link.getAttribute("href");
        if (href && !href.startsWith("#") && !href.startsWith("javascript:") &&
            !href.includes("weworkremotely.com/remote-jobs/")) {
          try {
            resolvedUrl = new URL(href, oldUrl).toString();
            break;
          } catch { continue; }
        }
      }

      // If link goes back to WWR (their /external/... redirect), click it and
      // capture the eventual URL after redirect.
      if (!resolvedUrl) {
        const wwrRedirect = page.locator('a[href*="weworkremotely.com/external/"], a[href*="weworkremotely.com/jobs/"]').first();
        if ((await wwrRedirect.count()) > 0) {
          const href = await wwrRedirect.getAttribute("href");
          if (href) {
            const targetUrl = new URL(href, oldUrl).toString();
            const page2 = await ctx.newPage();
            try {
              await page2.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
              await page2.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
              const finalUrl = page2.url();
              if (finalUrl && !finalUrl.includes("weworkremotely.com/external/")) {
                resolvedUrl = finalUrl;
              }
            } catch { /* swallow */ }
            await page2.close().catch(() => {});
          }
        }
      }

      if (resolvedUrl && resolvedUrl !== oldUrl) {
        console.log(`  ${r.company_name} | ${r.title}`);
        console.log(`    -> ${resolvedUrl}`);
        if (!dry) {
          await db.execute({
            sql: "UPDATE jobs SET apply_url = ? WHERE id = ?",
            args: [resolvedUrl, r.job_id as string],
          });
        }
        resolved++;
      } else {
        console.log(`  [no resolve] ${r.company_name} | ${r.title}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [error] ${r.company_name}: ${(err as Error).message.slice(0, 120)}`);
      failed++;
    } finally {
      await page.close().catch(() => {});
    }
  }

  console.log(`\nResolved ${resolved}, failed ${failed}. ${dry ? "(dry-run, no writes)" : ""}`);
  await browser.close().catch(() => {});
}
main().catch((e) => { console.error(e); process.exit(1); });
