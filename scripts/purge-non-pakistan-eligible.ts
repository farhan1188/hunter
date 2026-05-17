// One-shot cleanup: archive jobs whose visa_category is country_specific,
// and dismiss their in-flight applications. Already-submitted applications
// are preserved as history (terminal state, can't undo).
//
// IMPORTANT: 'unknown' is NOT archived — those jobs simply haven't been
// classified yet. Run process-pending-jobs.ts FIRST to classify them, then
// re-run this script.
//
// Run with:   npx tsx scripts/purge-non-pakistan-eligible.ts
// Add --dry to preview without writing.

import "dotenv/config";
import { getDb } from "@/src/db/client";

// Anything NOT in this list will be considered for archiving — except
// 'unknown', which is left alone (it just needs classification, not purging).
const ELIGIBLE = ["international_remote", "sponsorship_offered"];
const PROTECTED = ["unknown"];

async function main() {
  const dry = process.argv.includes("--dry");
  const db = getDb();

  // Target = NOT eligible AND NOT protected ('unknown').
  const KEEP = [...ELIGIBLE, ...PROTECTED];
  const placeholders = KEEP.map(() => "?").join(",");

  const { rows: jobsBefore } = await db.execute({
    sql: `SELECT visa_category, COUNT(*) AS n
            FROM jobs
           WHERE archived = 0 AND visa_category NOT IN (${placeholders})
           GROUP BY visa_category`,
    args: KEEP,
  });
  const { rows: appsBefore } = await db.execute({
    sql: `SELECT a.state, COUNT(*) AS n
            FROM applications a JOIN jobs j ON j.id = a.job_id
           WHERE j.visa_category NOT IN (${placeholders})
             AND a.state NOT IN ('submitted','submit_failed','dismissed','closed')
           GROUP BY a.state`,
    args: KEEP,
  });
  const { rows: appsSubmitFailed } = await db.execute({
    sql: `SELECT COUNT(*) AS n
            FROM applications a JOIN jobs j ON j.id = a.job_id
           WHERE j.visa_category NOT IN (${placeholders})
             AND a.state = 'submit_failed'`,
    args: KEEP,
  });

  console.log("=== Will archive these jobs ===");
  console.table(jobsBefore.map((r) => ({ visa_category: r.visa_category, n: Number(r.n) })));
  console.log("=== Will dismiss these in-flight applications ===");
  console.table(appsBefore.map((r) => ({ state: r.state, n: Number(r.n) })));
  const failedN = Number(appsSubmitFailed[0]?.n ?? 0);
  console.log(`=== Plus ${failedN} submit_failed apps → dismissed (US-only retries pointless) ===`);

  if (dry) {
    console.log("\n[--dry] no writes performed.");
    return;
  }

  // 1. Dismiss in-flight apps on non-eligible jobs.
  const r1 = await db.execute({
    sql: `UPDATE applications
             SET state = 'dismissed',
                 failure_reason = COALESCE(failure_reason, '')
                                  || ' [auto-dismissed 2026-05-17: visa_category not Pakistan-eligible]',
                 updated_at = datetime('now')
           WHERE job_id IN (SELECT id FROM jobs WHERE visa_category NOT IN (${placeholders}))
             AND state NOT IN ('submitted','dismissed','closed')`,
    args: KEEP,
  });
  console.log(`\nDismissed ${r1.rowsAffected} application rows.`);

  // 2. Archive the parent jobs.
  const r2 = await db.execute({
    sql: `UPDATE jobs SET archived = 1, status = 'closed'
           WHERE archived = 0 AND visa_category NOT IN (${placeholders})`,
    args: KEEP,
  });
  console.log(`Archived ${r2.rowsAffected} job rows.`);

  // 3. Verify post-state.
  const { rows: after } = await db.execute(`
    SELECT j.visa_category,
           SUM(CASE WHEN j.archived = 0 THEN 1 ELSE 0 END) AS active_jobs,
           SUM(CASE WHEN a.state = 'ready' THEN 1 ELSE 0 END) AS ready_apps,
           SUM(CASE WHEN a.state = 'submitted' THEN 1 ELSE 0 END) AS submitted_apps
      FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
     GROUP BY j.visa_category
     ORDER BY active_jobs DESC
  `);
  console.log("\n=== After ===");
  console.table(after.map((r) => ({
    visa_category: r.visa_category,
    active_jobs: Number(r.active_jobs ?? 0),
    ready_apps: Number(r.ready_apps ?? 0),
    submitted_apps: Number(r.submitted_apps ?? 0),
  })));
}

main().catch((e) => { console.error(e); process.exit(1); });
