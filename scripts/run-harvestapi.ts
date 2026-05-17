import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { getProfile, getSettings } from "@/src/profile/store";
import { runActorSync } from "@/src/core/discovery/apify-client";
import {
  harvestApiToJobPosting,
  normalizeAts,
  type HarvestApiItem,
} from "@/src/core/discovery/harvestapi-ingest";
import { insertJobs } from "@/src/core/jobs/persist";
import { classifyVisa } from "@/src/core/ingest/classify";
import { scoreJob } from "@/src/core/scoring/score";
import { saveScore } from "@/src/core/scoring/persist";
import { createQualified } from "@/src/core/applications/persist";

const ACTOR_ID = "zn01OAlzP853oqn4Z";

const COUNTRY_NAMES: Record<string, string> = {
  us: "United States",
  gb: "United Kingdom",
  uk: "United Kingdom",
  de: "Germany",
  nl: "Netherlands",
  ie: "Ireland",
  ca: "Canada",
  au: "Australia",
  ae: "United Arab Emirates",
  sg: "Singapore",
  pk: "Pakistan",
};

function parseArgs(): { rows: number; titles: number; locations: number } {
  const args = process.argv.slice(2);
  let rows = 5;
  let titles = 3;
  let locations = 3;
  for (const arg of args) {
    let m = arg.match(/^--rows=(\d+)$/);
    if (m) { rows = parseInt(m[1], 10); continue; }
    m = arg.match(/^--titles=(\d+)$/);
    if (m) { titles = parseInt(m[1], 10); continue; }
    m = arg.match(/^--locations=(\d+)$/);
    if (m) { locations = parseInt(m[1], 10); continue; }
  }
  return { rows, titles, locations };
}

async function main() {
  const { rows: maxItems, titles: titleCap, locations: locationCap } = parseArgs();
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set");

  const db = getDb();
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);

  // Build location list from union of work_auth + open_to_sponsorship countries,
  // mapped to LinkedIn-recognized names. Capped by --locations.
  // Sponsorship countries first — these are the markets the user actually targets.
  // work_auth countries appended only for completeness.
  const countryCodes = Array.from(
    new Set([
      ...(profile.preferences.open_to_sponsorship_countries ?? []),
      ...profile.preferences.work_auth_countries,
    ]),
  );
  const locations = countryCodes
    .map((code) => COUNTRY_NAMES[code.toLowerCase()])
    .filter((name): name is string => name !== undefined)
    .slice(0, locationCap);

  const jobTitles = profile.preferences.target_roles.slice(0, titleCap);

  // HarvestAPI input schema (apify.com/harvestapi/linkedin-job-search):
  // jobTitles (array), locations (array), maxItems is PER (title × location) pair.
  const input = {
    jobTitles,
    locations,
    maxItems,
    sortBy: "date" as const,
  };

  const maxFetched = jobTitles.length * locations.length * maxItems;
  console.log(
    `Apify input: ${jobTitles.length} title(s) × ${locations.length} location(s) × maxItems=${maxItems} (up to ${maxFetched} jobs)`,
  );
  console.log(`  titles:    ${JSON.stringify(jobTitles)}`);
  console.log(`  locations: ${JSON.stringify(locations)}`);
  console.log(`Running HarvestAPI actor...`);
  const startedAt = new Date().toISOString();

  const items = await runActorSync<HarvestApiItem>({
    actorId: ACTOR_ID,
    token,
    input,
    timeoutMs: 5 * 60 * 1000,
  });

  console.log(`Fetched ${items.length} jobs`);

  const postings = items.map(harvestApiToJobPosting);
  const insertedCount = await insertJobs(db, postings);

  console.log(`Inserted ${insertedCount} new`);

  // Process new jobs: classify visa, score, qualify
  let visaClassified = 0;
  let scored = 0;
  let qualified = 0;

  // Identify which postings are new by running insertJobs again — instead, we
  // re-check by comparing against what was returned: insertJobs returns total count.
  // We process all postings but only new ones get classified/scored.
  // Strategy: fetch the IDs that now exist in DB after insert, then check which
  // were just inserted by querying scores (no score = likely new).
  // Simpler: process all postings; createQualified is idempotent, so re-running
  // on an already-qualified job is safe. For visa/score we only do new ones.
  // We'll use a lightweight check: if a score row exists for this job, skip.
  const jobIds = postings.map((p) => p.id);
  const ph = jobIds.map(() => "?").join(",");
  const { rows: scoredRows } = await db.execute({
    sql: `SELECT job_id FROM scores WHERE job_id IN (${ph})`,
    args: jobIds,
  });
  const alreadyScored = new Set(scoredRows.map((r) => r.job_id as string));

  for (const posting of postings) {
    if (alreadyScored.has(posting.id)) continue;

    // Classify visa
    try {
      const visa = await classifyVisa(posting);
      await db.execute({
        sql: `UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ? WHERE id = ?`,
        args: [
          visa.category,
          JSON.stringify(visa.target_countries),
          visa.target_timezone,
          posting.id,
        ],
      });
      visaClassified++;
    } catch (err) {
      console.error(`Visa classify failed for ${posting.id}:`, err);
    }

    // Score
    try {
      const score = await scoreJob(profile, posting);
      await saveScore(db, score);
      scored++;

      // Qualify if above threshold
      if (score.value >= settings.score_threshold) {
        const atsVendor = normalizeAts(posting.ats_vendor ?? null);
        await createQualified(db, posting.id, null, atsVendor);
        qualified++;
      }
    } catch (err) {
      console.error(`Score failed for ${posting.id}:`, err);
    }
  }

  console.log(`Visa-classified ${visaClassified}`);
  console.log(`Scored ${scored}`);
  console.log(`Qualified ${qualified}`);

  // Update adapter row
  const finishedAt = new Date().toISOString();
  await db.execute({
    sql: `UPDATE adapters SET last_run_at = ?, last_success_at = ? WHERE name = 'linkedin'`,
    args: [finishedAt, finishedAt],
  });

  // Log to routine_runs
  const stats = {
    fetched: items.length,
    inserted: insertedCount,
    visa_classified: visaClassified,
    scored,
    qualified,
  };
  await db.execute({
    sql: `INSERT INTO routine_runs (routine, started_at, finished_at, ok, stats_json)
          VALUES ('harvestapi', ?, ?, 1, ?)`,
    args: [startedAt, finishedAt, JSON.stringify(stats)],
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
