import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const r = await db.execute(
    "SELECT j.source, j.visa_category, COUNT(*) AS n FROM jobs j LEFT JOIN scores s ON s.job_id = j.id WHERE j.archived = 0 AND s.job_id IS NULL GROUP BY j.source, j.visa_category ORDER BY n DESC",
  );
  console.table(r.rows.map((row) => ({ source: row.source, visa_category: row.visa_category, n: Number(row.n) })));
  console.log("Total unscored:", r.rows.reduce((s, x) => s + Number(x.n), 0));
}
main().catch((e) => { console.error(e); process.exit(1); });
