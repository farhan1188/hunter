import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(`
    SELECT j.visa_category,
           COUNT(*) AS total,
           SUM(CASE WHEN a.state='ready' THEN 1 ELSE 0 END) AS ready,
           SUM(CASE WHEN a.state='qualified' THEN 1 ELSE 0 END) AS qualified,
           SUM(CASE WHEN a.state='submitted' THEN 1 ELSE 0 END) AS submitted
    FROM jobs j LEFT JOIN applications a ON a.job_id=j.id
    WHERE j.archived=0
    GROUP BY j.visa_category
    ORDER BY total DESC
  `);
  console.table(rows.map((r) => ({
    visa_category: r.visa_category,
    total_jobs: Number(r.total),
    qualified: Number(r.qualified ?? 0),
    ready: Number(r.ready ?? 0),
    submitted: Number(r.submitted ?? 0),
  })));
}
main().catch((e) => { console.error(e); process.exit(1); });
