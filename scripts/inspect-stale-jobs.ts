import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  // Overall counts
  const { rows: totals } = await db.execute(
    `SELECT source, status, COUNT(*) AS n
       FROM jobs GROUP BY source, status ORDER BY n DESC`
  );
  console.log("Jobs by source × status:");
  for (const r of totals) console.log(`  ${r.source}/${r.status}: ${r.n}`);

  const { rows: byDate } = await db.execute(
    `SELECT DATE(fetched_at) AS d, source, COUNT(*) AS n
       FROM jobs GROUP BY d, source ORDER BY d DESC LIMIT 30`
  );
  console.log("\nJobs by fetched-date × source:");
  for (const r of byDate) console.log(`  ${r.d} ${r.source}: ${r.n}`);

  const { rows: visa } = await db.execute(
    `SELECT visa_category, COUNT(*) AS n FROM jobs GROUP BY visa_category ORDER BY n DESC`
  );
  console.log("\nJobs by visa_category:");
  for (const r of visa) console.log(`  ${r.visa_category}: ${r.n}`);

  const { rows: scored } = await db.execute(
    `SELECT
       SUM(CASE WHEN s.value IS NULL THEN 1 ELSE 0 END) AS unscored,
       SUM(CASE WHEN s.value < 30 THEN 1 ELSE 0 END) AS low,
       SUM(CASE WHEN s.value BETWEEN 30 AND 59 THEN 1 ELSE 0 END) AS mid,
       SUM(CASE WHEN s.value BETWEEN 60 AND 74 THEN 1 ELSE 0 END) AS edge,
       SUM(CASE WHEN s.value >= 75 THEN 1 ELSE 0 END) AS high
     FROM jobs j LEFT JOIN scores s ON s.job_id = j.id`
  );
  console.log("\nScoring distribution:");
  console.log(`  ${JSON.stringify(scored[0])}`);

  // How many would survive a "clean" pass with current preferences?
  // Survivors:
  // - status != 'closed'
  // - posted_at within last 21 days (LinkedIn typical relevance window)
  // - either visa is international_remote/sponsorship_offered, or country in current allowed countries
  // - has a score >= 60 (kept some borderline) — or actively in an application
  const { rows: survival } = await db.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN j.status = 'closed' THEN 1 ELSE 0 END) AS closed,
       SUM(CASE WHEN j.posted_at < datetime('now','-21 day') THEN 1 ELSE 0 END) AS old_posted,
       SUM(CASE WHEN s.value IS NULL THEN 1 ELSE 0 END) AS unscored,
       SUM(CASE WHEN s.value < 60 THEN 1 ELSE 0 END) AS below_60,
       SUM(CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END) AS in_pipeline
     FROM jobs j
     LEFT JOIN scores s ON s.job_id = j.id
     LEFT JOIN applications a ON a.job_id = j.id`
  );
  console.log("\nSurvival baseline (BEFORE deletion):");
  console.log(`  ${JSON.stringify(survival[0])}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
