// Scrape remotejobsfinder.co's "recommended" page using the user's
// authenticated Chrome session on port 9222. Extracts job title, company,
// and external apply URL (where present) and inserts into the jobs table.
// Visa classification + scoring happens via process-pending-jobs.ts after.

import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

import { chromium } from "playwright-core";
import { getDb } from "@hub/db/client";
import { insertJobs } from "@hub/core/jobs/persist";
import { makeJobId, nowIso } from "@hub/core/adapters/util";
import type { JobPosting } from "@hub/core/types";
import { createHash } from "node:crypto";

const CDP_URL = process.env.CDP_URL || "http://localhost:9222";
const RECOMMENDED_URL = "https://remotejobsfinder.co/en/platform/recommended";

async function main() {
  const dry = process.argv.includes("--dry");
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();

  console.log(`Opening ${RECOMMENDED_URL} in authenticated Chrome...`);
  await page.goto(RECOMMENDED_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Site uses long-polling so networkidle never resolves; just wait for the
  // job cards to hydrate.
  await page.waitForTimeout(4000);

  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(1200);
  }

  // Inspect one card's HTML structure to understand how to extract URLs.
  if (process.argv.includes("--inspect")) {
    const sample = await page.evaluate(() => {
      const cards = document.querySelectorAll("div.cursor-pointer, [class*='cursor-pointer']");
      const eligible = Array.from(cards).find((el) => {
        const t = (el as HTMLElement).innerText?.toLowerCase() ?? "";
        return /anywhere|\(pk\)|global/.test(t);
      });
      if (!eligible) return null;
      const outer = (eligible as HTMLElement).closest("[data-job-id], [data-id], [data-href], article, li, div[id*='job']") ?? eligible;
      return {
        outerTag: outer.tagName,
        outerId: outer.id,
        outerClass: (outer.className || "").toString().slice(0, 200),
        dataAttrs: Object.fromEntries(Array.from((outer as HTMLElement).attributes).filter((a) => a.name.startsWith("data-")).map((a) => [a.name, a.value])),
        innerHTML: (outer as HTMLElement).innerHTML.slice(0, 1500),
      };
    });
    console.log("SAMPLE CARD:", JSON.stringify(sample, null, 2));
    await browser.close();
    return;
  }

  // remotejobsfinder.co cards are React divs with class "cursor-pointer"
  // (no real anchors). Find candidate card containers, parse their text
  // for company/title/location, then click each to get the detail URL.
  const cardData = await page.evaluate(() => {
    const out: Array<{ idx: number; text: string }> = [];
    const candidates = document.querySelectorAll("div.cursor-pointer, [class*='cursor-pointer']");
    let idx = 0;
    for (const el of candidates) {
      const txt = (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim() ?? "";
      if (txt.length > 30 && txt.length < 500 &&
          /\b(today|yesterday|\d+\s*(?:day|hour|week)s?\s*ago)\b/i.test(txt) &&
          /\b(senior|principal|staff|product|manager|engineer|director|lead|designer|developer)\b/i.test(txt)) {
        (el as HTMLElement).dataset.rjfIdx = String(idx);
        out.push({ idx, text: txt });
        idx++;
      }
    }
    return out;
  });

  console.log(`Spotted ${cardData.length} card candidates. Parsing + clicking each to get URL...`);

  const jobs: Array<{ url: string; title: string; company: string; location: string }> = [];
  for (const card of cardData) {
    // Parse text → company / title / location
    const parts = card.text.split(/\s{2,}|\n/).map((s) => s.trim()).filter(Boolean);
    let company = ""; let title = ""; let location = "";
    for (let i = 0; i < parts.length; i++) {
      if (/^(?:today|yesterday|\d+\s*(?:day|hour|week|min)s?\s*ago)$/i.test(parts[i])) {
        company = parts[i - 1] ?? "";
        title = parts[i + 1] ?? "";
        location = parts.slice(i + 2).find((x) => /remote|hybrid|on-?site|anywhere|\(pk\)|\(in\)|\(us\)|\(uk\)/i.test(x)) ?? "";
        break;
      }
    }
    if (!title) {
      // Fallback: split by single-space chunks
      const splits = card.text.split(/\b(?:today|yesterday|\d+\s*(?:day|hour|week|min)s?\s*ago)\b/i);
      if (splits.length >= 2) {
        company = splits[0].trim();
        const rest = splits[1].trim().split(/\$\d/, 1)[0].trim();
        title = rest.split(" Remote ")[0] ?? rest.slice(0, 80);
        const locMatch = splits[1].match(/Remote\s*\([^)]+\)/i);
        location = locMatch ? locMatch[0] : "Remote";
      }
    }

    // Skip if no Pakistan eligibility signal (anywhere / pk / global)
    const isEligible = /\banywhere\b|\(pk\)|\bglobal\b|\bworldwide\b/i.test(location) ||
                       /\banywhere\b|\(pk\)|\bglobal\b|\bworldwide\b/i.test(card.text);
    if (!isEligible) continue;

    // Click the card to navigate
    try {
      const [newPage] = await Promise.all([
        ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null),
        page.locator(`[data-rjf-idx="${card.idx}"]`).click({ timeout: 5000 }).catch(() => {}),
      ]);
      let detailUrl: string;
      let pageToClose: typeof page | null = null;
      if (newPage) {
        await newPage.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
        detailUrl = newPage.url();
        pageToClose = newPage as typeof page;
      } else {
        // Card clicked in same tab; URL changed.
        await page.waitForTimeout(1500);
        detailUrl = page.url();
        // Need to navigate back to recommendations to continue clicking.
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      if (pageToClose) await pageToClose.close().catch(() => {});
      jobs.push({ url: detailUrl, title, company: company || "unknown", location: location || "Remote" });
      console.log(`  + ${company} | ${title} [${location}] -> ${detailUrl}`);
    } catch (err) {
      console.error(`  ! ${company} | ${title}: ${(err as Error).message.slice(0, 80)}`);
    }
  }
  // Replace the rest of the original block (below) — we've already populated jobs.

  console.log(`Found ${jobs.length} job cards.`);
  if (jobs.length === 0) {
    console.log("No jobs detected — debugging anchor structure:");
    const debug = await page.evaluate(() => {
      // Walk all elements with a "Senior" or "Manager" or "Engineer" in text
      // to find the card containers.
      const out: Array<{ tag: string; classes: string; sample: string }> = [];
      const els = document.querySelectorAll("div, article, li, section");
      for (const el of els) {
        const txt = (el as HTMLElement).innerText?.replace(/\s+/g, " ").trim() ?? "";
        if (txt.length > 30 && txt.length < 400 &&
            /\b(senior|principal|staff)\b/i.test(txt) &&
            /\b(manager|engineer|product|designer|director)\b/i.test(txt) &&
            /\b(today|yesterday|\d+\s*(?:day|hour|week)s?\s*ago)\b/i.test(txt)) {
          out.push({
            tag: el.tagName,
            classes: (el.className || "").toString().slice(0, 120),
            sample: txt.slice(0, 200),
          });
          if (out.length >= 5) break;
        }
      }
      return out;
    });
    for (const d of debug) console.log("  el:", d.tag, "class=", d.classes, "\n    text:", d.sample);
    await browser.close();
    return;
  }

  // For each job card, fetch the listing detail to find an external apply URL.
  const postings: JobPosting[] = [];
  for (const j of jobs.slice(0, 25)) {
    try {
      const detail = await ctx.newPage();
      await detail.goto(j.url, { waitUntil: "networkidle", timeout: 30000 });
      // Look for external apply link.
      const applyHref = await detail.evaluate(() => {
        const selectors = [
          'a[href*="boards.greenhouse.io"]',
          'a[href*="job-boards.greenhouse.io"]',
          'a[href*="jobs.lever.co"]',
          'a[href*="ashbyhq.com"]',
          'a[href*="apply.workable.com"]',
          'a[href*="myworkdayjobs.com"]',
          'a[href*="smartrecruiters.com"]',
          'a:not([href*="remotejobsfinder.co"])[href^="http"]',
        ];
        for (const sel of selectors) {
          const els = Array.from(document.querySelectorAll(sel));
          for (const el of els) {
            const a = el as HTMLAnchorElement;
            const txt = (a.innerText || "").toLowerCase();
            if (txt.includes("apply") || /greenhouse|lever|ashby|workable|workday|smartrecruiters/i.test(a.href)) {
              return a.href;
            }
          }
        }
        return null;
      });
      const descText = await detail.evaluate(() => document.body.innerText.slice(0, 6000));
      await detail.close().catch(() => {});

      const externalId = createHash("sha256").update(j.url).digest("hex").slice(0, 16);
      postings.push({
        id: makeJobId("manual" as never, externalId),
        source: "manual" as never,
        external_id: externalId,
        url: j.url,
        apply_url: applyHref ?? j.url,
        ats_vendor: null,
        company: { name: j.company },
        title: j.title,
        location: { remote: /remote/i.test(j.location), raw: j.location || "Remote" },
        visa: { category: "unknown", target_countries: [] },
        description_md: descText,
        posted_at: nowIso(),
        fetched_at: nowIso(),
      });
      console.log(`  ${j.company} | ${j.title} -> ${applyHref ?? "[no external apply]"}`);
    } catch (err) {
      console.error(`  err on ${j.url}:`, (err as Error).message.slice(0, 100));
    }
  }

  console.log(`\nCollected ${postings.length} postings with descriptions.`);
  if (!dry) {
    const db = getDb();
    const inserted = await insertJobs(db, postings);
    console.log(`Inserted ${inserted} new rows (${postings.length - inserted} dupes).`);
  } else {
    console.log("Dry-run, not inserting.");
  }

  await browser.close().catch(() => {});
}
main().catch((e) => { console.error(e); process.exit(1); });
