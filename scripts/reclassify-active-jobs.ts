// Re-run the (now-tightened) visa classifier on every non-archived job.
// Run BEFORE re-purging — the classifier downgrades over-generous
// international_remote labels back to country_specific/unknown.
//
// Idempotent. Logs each change. Safe to run repeatedly.

import "dotenv/config";
import { getDb } from "@/src/db/client";
import { classifyVisa } from "@/src/core/ingest/classify";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT id, title, company_name, location_raw, description_md, visa_category FROM jobs WHERE archived = 0 ORDER BY fetched_at DESC",
  );
  console.log(`Re-classifying ${rows.length} active jobs...\n`);

  let unchanged = 0;
  let changed = 0;
  const downgrades: Array<{ company: string; title: string; from: string; to: string }> = [];

  for (const r of rows) {
    const before = r.visa_category as string;
    try {
      const result = await classifyVisa({
        title: r.title as string,
        company: { name: r.company_name as string },
        location: { remote: false, raw: r.location_raw as string },
        description_md: r.description_md as string,
      });
      if (result.category === before) {
        unchanged++;
        continue;
      }
      await db.execute({
        sql: "UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ? WHERE id = ?",
        args: [
          result.category,
          JSON.stringify(result.target_countries),
          result.target_timezone,
          r.id,
        ],
      });
      changed++;
      console.log(`  [${before} → ${result.category}] ${r.company_name} — ${r.title}`);
      if (before === "international_remote" && result.category !== "international_remote") {
        downgrades.push({
          company: r.company_name as string,
          title: r.title as string,
          from: before,
          to: result.category,
        });
      }
    } catch (err) {
      console.error(`  ERROR ${r.company_name} — ${r.title}:`, err);
    }
  }

  console.log(`\nDone. ${changed} changed, ${unchanged} unchanged.`);
  if (downgrades.length > 0) {
    console.log(`\n${downgrades.length} jobs DOWNGRADED from international_remote — purge run recommended:`);
    for (const d of downgrades) console.log(`  - ${d.company} / ${d.title} → ${d.to}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
