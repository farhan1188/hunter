// Throttled batch processor for jobs that have been ingested but not yet
// classified/scored/qualified. Stays under the 50k input-tokens/min Haiku
// rate limit with a small delay between LLM calls.
//
// Useful after a discovery run (HarvestAPI or any of the global-remote
// adapters) has dumped raw rows but the per-job classify+score loop ran
// into 429s.
//
// Idempotent — only touches jobs missing a score row.

import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getProfile, getSettings } from "@/src/profile/store";
import { classifyVisa } from "@/src/core/ingest/classify";
import { scoreJob } from "@/src/core/scoring/score";
import { saveScore } from "@/src/core/scoring/persist";
import { createQualified } from "@/src/core/applications/persist";
import type { JobPosting } from "@/src/core/types";

const DELAY_MS = 1500; // ~40 jobs/min, well under the 50k token/min ceiling

async function main() {
  // --max-qualified=N: stop early once N qualifications have landed (for the
  // 10-app target — no need to process all 267).
  // --classify-only: skip the score step (used during the cheap pre-filter pass).
  const args = process.argv.slice(2);
  const maxQualified = (() => {
    for (const a of args) {
      const m = a.match(/^--max-qualified=(\d+)$/);
      if (m) return parseInt(m[1], 10);
    }
    return Infinity;
  })();
  const classifyOnly = args.includes("--classify-only");

  const db = getDb();
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);

  // --source=X to restrict to one adapter (e.g. greenhouse — those have
  // direct ATS apply URLs, unlike weworkremotely/jobicy/etc which all have
  // gated listing URLs).
  const sourceFilter = (() => {
    for (const a of args) {
      const m = a.match(/^--source=([\w-]+)$/);
      if (m) return m[1];
    }
    return null;
  })();

  const { rows } = await db.execute({
    sql: `
      SELECT j.id, j.source, j.external_id, j.url, j.apply_url, j.ats_vendor,
             j.company_name, j.title, j.location_remote, j.location_raw,
             j.description_md, j.posted_at, j.visa_category
        FROM jobs j
        LEFT JOIN scores s ON s.job_id = j.id
       WHERE s.job_id IS NULL
         AND j.archived = 0
         ${sourceFilter ? "AND j.source = ?" : ""}
       ORDER BY j.fetched_at DESC
    `,
    args: sourceFilter ? [sourceFilter] : [],
  });
  console.log(`Pending: ${rows.length} jobs need classify+score+qualify.`);

  let classified = 0;
  let scored = 0;
  let qualified = 0;
  let skippedByGate = 0;
  let errored = 0;

  for (const r of rows) {
    const label = `${r.company_name} — ${r.title}`;
    const posting: JobPosting = {
      id: r.id as string,
      source: r.source as JobPosting["source"],
      external_id: r.external_id as string,
      url: r.url as string,
      apply_url: r.apply_url as string | null,
      ats_vendor: r.ats_vendor as string | null,
      company: { name: r.company_name as string },
      title: r.title as string,
      location: {
        remote: Boolean(r.location_remote),
        raw: r.location_raw as string,
      },
      visa: { category: "unknown", target_countries: [] },
      description_md: r.description_md as string,
      posted_at: r.posted_at as string,
      fetched_at: new Date().toISOString(),
    };

    try {
      // Classify visa unless already done (skip if classifier already ran).
      if (r.visa_category === "unknown" || !r.visa_category) {
        const visa = await classifyVisa(posting);
        await db.execute({
          sql: `UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ? WHERE id = ?`,
          args: [visa.category, JSON.stringify(visa.target_countries), visa.target_timezone, posting.id],
        });
        posting.visa.category = visa.category;
        classified++;
        await new Promise((res) => setTimeout(res, DELAY_MS));
      } else {
        posting.visa.category = r.visa_category as JobPosting["visa"]["category"];
      }

      // Skip scoring if --classify-only OR the visa gate already rejected — no
      // point spending a Haiku call on a job we'd never qualify.
      if (classifyOnly) {
        await new Promise((res) => setTimeout(res, DELAY_MS));
        continue;
      }
      const eligible = posting.visa.category === "international_remote" || posting.visa.category === "sponsorship_offered";
      if (!eligible) {
        skippedByGate++;
        await new Promise((res) => setTimeout(res, DELAY_MS));
        continue;
      }

      // Score
      const score = await scoreJob(profile, posting);
      await saveScore(db, score);
      scored++;

      // Qualify if score >= threshold (gate enforces visa eligibility internally)
      if (score.value >= settings.score_threshold) {
        const appId = await createQualified(db, posting.id, null, posting.ats_vendor ?? null);
        if (appId) {
          qualified++;
          console.log(`  [qualified] ${label} — score=${score.value}, visa=${posting.visa.category}`);
          if (qualified >= maxQualified) {
            console.log(`\nReached --max-qualified=${maxQualified}, stopping early.`);
            break;
          }
        } else {
          skippedByGate++;
        }
      }
      await new Promise((res) => setTimeout(res, DELAY_MS));
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [error] ${label}: ${msg.slice(0, 200)}`);
      // Backoff harder on rate limit
      if (msg.includes("rate_limit") || msg.includes("429")) {
        console.log("    rate-limited, sleeping 60s...");
        await new Promise((res) => setTimeout(res, 60_000));
      }
    }
  }

  console.log(`\nDone. classified=${classified} scored=${scored} qualified=${qualified} skipped_by_gate=${skippedByGate} errored=${errored}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
