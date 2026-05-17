// Pull remotejobsfinder.co recommended jobs directly from their API
// using the authenticated browser session's cookies, then ingest into
// our jobs table with proper visa_category (the API tells us type:
// "worldwide" | "country-specific" | etc, so we can skip the LLM
// classifier for these).

import * as path from "node:path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

import { chromium } from "playwright-core";
import { getDb } from "@hub/db/client";
import { insertJobs } from "@hub/core/jobs/persist";
import { makeJobId, nowIso } from "@hub/core/adapters/util";
import type { JobPosting } from "@hub/core/types";

const API_BASE = "https://rjf-gateway-prod.globalwork.ai/api/v1";
const RECOMMENDED_URL = "https://remotejobsfinder.co/en/platform/recommended";

interface RjfJob {
  uuid: string;
  title: string;
  companyName: string;
  jobUrl: string;
  applyUrl?: string | null;
  type: string;
  locations?: Array<{ country?: string; city?: string }>;
  level?: string;
  description?: string;
  rateHourlyMin?: number;
  rateHourlyMax?: number;
  rateUnit?: string;
  commitments?: string[];
}

function rjfTypeToVisa(type: string): "international_remote" | "country_specific" | "unknown" {
  const t = (type || "").toLowerCase();
  // NEVER trust the RJF "worldwide" tag at face value — many of them are
  // actually country-locked per the company's JD header (verified
  // 2026-05-17: Counterpart Health + Clover Health flagged "worldwide" but
  // posting said "Remote - USA"). Default everything to 'unknown' so our
  // own paranoid classifier reads the actual description + header and
  // decides. The classifier is in src/core/ingest/classify.ts.
  if (t === "country-specific" || t === "country_specific" || t === "local") return "country_specific";
  return "unknown";
}

async function main() {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || "http://localhost:9222");
  const ctx = browser.contexts()[0] ?? (await browser.newContext());
  const page = await ctx.newPage();

  // Visit the recommended page to pick up auth cookies + capture the
  // Authorization header used by the SPA.
  let bearerToken: string | null = null;
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(API_BASE)) return;
    const auth = req.headers()["authorization"] ?? req.headers()["Authorization"];
    if (auth && !bearerToken) bearerToken = auth;
  });
  await page.goto(RECOMMENDED_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await page.close().catch(() => {});

  if (!bearerToken) console.warn("(no Authorization header captured — may need to relogin)");
  else console.log("Captured bearer token from session.");

  // Use the BROWSER context (which has session cookies + auth) to call the
  // API directly with pagination instead of relying on lazy-scroll triggers.
  const apiPage = await ctx.newPage();
  await apiPage.goto(RECOMMENDED_URL, { waitUntil: "domcontentloaded" });
  await apiPage.waitForTimeout(2500);

  let allJobs: RjfJob[] = [];
  // Try /jobs/recommended with pagination params (?skip=N&limit=20).
  // Use the captured bearer token; cookies alone return 401 from this gateway.
  for (let skip = 0; skip < 200; skip += 20) {
    const url = `${API_BASE}/jobs/recommended?skip=${skip}&limit=20`;
    const json = await apiPage.evaluate(async (args) => {
      const r = await fetch(args.u, {
        credentials: "include",
        headers: args.token ? { Authorization: args.token } : {},
      });
      if (!r.ok) return { error: r.status };
      return r.json();
    }, { u: url, token: bearerToken });
    if (json && typeof json === "object" && "data" in json && Array.isArray((json as { data: RjfJob[] }).data)) {
      const batch = (json as { data: RjfJob[] }).data;
      allJobs.push(...batch);
      console.log(`  skip=${skip} → got ${batch.length}, running total ${allJobs.length}`);
      if (batch.length < 20) break;
    } else {
      console.log(`  skip=${skip} → no data, stopping (${JSON.stringify(json).slice(0, 100)})`);
      break;
    }
  }
  await apiPage.close().catch(() => {});

  console.log(`Got ${allJobs.length} recommended jobs from API.`);
  if (allJobs.length === 0) { await browser.close(); return; }

  // For Greenhouse jobs, fetch the real JD from boards-api so the classifier
  // can see the actual hiring scope (RJF's `description` field is often empty
  // or thin). The boards-api is public; no auth needed.
  async function fetchGreenhouseJd(jobUrl: string): Promise<{ description: string; locationRaw: string } | null> {
    const m = jobUrl.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
    if (!m) return null;
    const [, token, jobId] = m;
    try {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${jobId}?questions=false`);
      if (!r.ok) return null;
      const data = await r.json() as { content?: string; location?: { name?: string }; title?: string };
      const desc = (data.content ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
      const loc = data.location?.name ?? "";
      // Prepend the location to the description so the classifier sees it
      // prominently (Greenhouse puts "Remote - USA" in `location.name`, not in
      // the body of `content`).
      return { description: `Location: ${loc}\n\n${desc}`, locationRaw: loc };
    } catch { return null; }
  }

  // Map → JobPosting and insert
  const postings: JobPosting[] = [];
  for (const j of allJobs) {
    const externalId = `rjf-${j.uuid}`;
    const applyUrl = j.applyUrl || j.jobUrl;
    let atsVendor: string | null = null;
    if (/greenhouse\.io|gh_jid=/i.test(applyUrl)) atsVendor = "greenhouse";
    else if (/jobs\.lever\.co/i.test(applyUrl)) atsVendor = "lever";
    else if (/ashbyhq\.com/i.test(applyUrl)) atsVendor = "ashby";
    else if (/myworkdayjobs\.com/i.test(applyUrl)) atsVendor = "workday";

    // Authoritative location + description from the company's own ATS when possible.
    const ghJd = atsVendor === "greenhouse" ? await fetchGreenhouseJd(j.jobUrl) : null;
    const locRaw = ghJd?.locationRaw
      || (j.locations ?? []).map((l) => [l.city, l.country].filter(Boolean).join(", ")).join("; ")
      || j.type
      || "Remote";
    const description = ghJd?.description
      || j.description
      || `${j.title} @ ${j.companyName}\n\nLevel: ${j.level ?? "n/a"}\nCommitments: ${(j.commitments ?? []).join(", ")}\nRate: ${j.rateHourlyMin ?? "?"}-${j.rateHourlyMax ?? "?"} ${j.rateUnit ?? ""}`;

    postings.push({
      id: makeJobId("manual" as never, externalId),
      source: "manual" as never,
      external_id: externalId,
      url: j.jobUrl,
      apply_url: applyUrl,
      ats_vendor: atsVendor,
      company: { name: j.companyName },
      title: j.title,
      location: { remote: true, raw: locRaw },
      visa: {
        category: rjfTypeToVisa(j.type),
        target_countries: [],
      },
      description_md: description,
      posted_at: nowIso(),
      fetched_at: nowIso(),
    });
  }

  const db = getDb();
  const inserted = await insertJobs(db, postings);
  console.log(`Inserted ${inserted} new (${postings.length - inserted} duplicates).`);

  // Summary by visa_category
  const counts: Record<string, number> = {};
  for (const p of postings) counts[p.visa.category] = (counts[p.visa.category] ?? 0) + 1;
  console.log("By visa_category:", counts);

  // Summary by ats_vendor
  const vendors: Record<string, number> = {};
  for (const p of postings) vendors[p.ats_vendor ?? "none"] = (vendors[p.ats_vendor ?? "none"] ?? 0) + 1;
  console.log("By ats_vendor:", vendors);

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
