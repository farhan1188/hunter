// Delete jobs that today's pipeline wouldn't pull in — Phase 1 leftovers,
// unscored noise, low-fit / stale postings. Preserves anything tied to an
// active application so the pipeline view isn't disturbed.
//
// Keep rule: KEEP if any of —
//   - jobs.id appears in applications (regardless of state)
//   - score.value >= 60 AND posted_at >= now-21d
//
// Delete everything else, plus cascading orphan scores.
// Dry-run by default; pass --apply to actually delete.

import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();

  // Find rows to KEEP.
  const KEEP_SQL = `
    SELECT DISTINCT j.id
      FROM jobs j
      LEFT JOIN scores s ON s.job_id = j.id
      LEFT JOIN applications a ON a.job_id = j.id
     WHERE a.id IS NOT NULL
        OR (s.value >= 60 AND j.posted_at >= datetime('now','-21 day'))
  `;

  const { rows: keepRows } = await db.execute(KEEP_SQL);
  const keepIds = new Set(keepRows.map((r) => r.id as string));
  const { rows: total } = await db.execute("SELECT COUNT(*) AS n FROM jobs");
  const totalN = Number(total[0].n);

  const toDelete = totalN - keepIds.size;
  console.log(`Total jobs: ${totalN}`);
  console.log(`Will KEEP: ${keepIds.size}`);
  console.log(`Will DELETE: ${toDelete}`);
  console.log();

  // Show a sample of what gets deleted to sanity check.
  const { rows: sample } = await db.execute({
    sql: `SELECT j.title, j.company_name, j.source, j.posted_at, s.value AS score
            FROM jobs j
            LEFT JOIN scores s ON s.job_id = j.id
            LEFT JOIN applications a ON a.job_id = j.id
           WHERE a.id IS NULL
             AND NOT (s.value >= 60 AND j.posted_at >= datetime('now','-21 day'))
           ORDER BY RANDOM() LIMIT 8`,
    args: [],
  });
  console.log("Sample of deletions:");
  for (const r of sample) {
    console.log(`  [${r.source}] ${r.title} @ ${r.company_name} (posted ${r.posted_at}, score=${r.score ?? "—"})`);
  }
  console.log();

  if (!apply) {
    console.log("Dry run. Pass --apply to actually delete.");
    return;
  }

  // Apply the keep rule as an exclusion delete. scores has ON DELETE CASCADE
  // for job_id so we don't need to manually drop scores.
  const res = await db.execute({
    sql: `DELETE FROM jobs WHERE id NOT IN (${KEEP_SQL})`,
    args: [],
  });
  console.log(`Deleted ${res.rowsAffected} jobs.`);

  // Re-count just to be sure.
  const { rows: after } = await db.execute("SELECT COUNT(*) AS n FROM jobs");
  console.log(`Remaining: ${after[0].n}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
