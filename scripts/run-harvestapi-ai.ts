// Targeted HarvestAPI run for AI-native PM / Solutions roles posted as
// Worldwide remote. Bypasses profile.target_roles to use a tightly
// curated AI-focused title list and Worldwide-only location so noise is
// minimized.
//
// Usage: npx tsx scripts/run-harvestapi-ai.ts [--rows=12]
//
// Per-call cost: ~$0.05-$0.10 on Apify. Returns AI Solutions Engineer /
// AI Product Manager / Forward Deployed Engineer / Developer Advocate /
// Applied AI roles posted in "Worldwide" location.

import "dotenv/config";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { runActorSync } from "@/src/core/discovery/apify-client";
import {
  harvestApiToJobPosting,
  type HarvestApiItem,
} from "@/src/core/discovery/harvestapi-ingest";
import { insertJobs } from "@/src/core/jobs/persist";

const ACTOR_ID = "zn01OAlzP853oqn4Z";

const AI_TITLES = [
  "AI Solutions Engineer",
  "AI Product Manager",
  "Forward Deployed Engineer",
  "Applied AI Engineer",
  "Developer Advocate AI",
  "AI Solutions Architect",
  "Solutions Engineer LLM",
  "Product Manager LLM",
];

function parseRows(): number {
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--rows=(\d+)$/);
    if (m) return parseInt(m[1], 10);
  }
  return 10;
}

async function main() {
  const maxItems = parseRows();
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN is not set");

  // LinkedIn's Worldwide filter is too restrictive for AI titles. Search in
  // major AI-hire markets where companies post; let the JD classifier do
  // the Pakistan-eligibility filtering downstream.
  const locations = ["United States", "United Kingdom", "Worldwide"];
  const input = {
    jobTitles: AI_TITLES,
    locations,
    maxItems,
    sortBy: "date" as const,
  };

  const projected = AI_TITLES.length * locations.length * maxItems;
  console.log(`HarvestAPI input: ${AI_TITLES.length} AI titles × ${locations.length} locations × maxItems=${maxItems} (up to ${projected} jobs)`);
  console.log(`  titles: ${AI_TITLES.join(", ")}`);
  console.log(`  locations: ${locations.join(", ")}`);

  const items = await runActorSync<HarvestApiItem>({
    actorId: ACTOR_ID,
    token,
    input,
    timeoutMs: 5 * 60 * 1000,
  });
  console.log(`Fetched ${items.length} jobs`);

  const postings = items.map(harvestApiToJobPosting);
  const db = getDb();
  const inserted = await insertJobs(db, postings);
  console.log(`Inserted ${inserted} new (${postings.length - inserted} duplicates).`);
  // Note: visa classification + scoring happens via scripts/process-pending-jobs.ts
  // which respects the Pakistan-eligibility gate.
  console.log(`Next: npx tsx scripts/process-pending-jobs.ts --max-qualified=15`);
}
main().catch((e) => { console.error(e); process.exit(1); });
