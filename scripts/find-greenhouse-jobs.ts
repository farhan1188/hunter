import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT j.id, j.title, j.company_name, j.apply_url, j.ats_vendor, a.state, s.value AS score
       FROM jobs j
       LEFT JOIN applications a ON a.job_id = j.id
       LEFT JOIN scores s ON s.job_id = j.id
      WHERE j.apply_url LIKE '%greenhouse%' OR j.ats_vendor = 'greenhouse'
      ORDER BY s.value DESC NULLS LAST`,
  );
  if (rows.length === 0) {
    console.log("No Greenhouse jobs in DB.");
    return;
  }
  for (const r of rows) {
    console.log(`[${r.score ?? "—"}] [${r.state ?? "no app"}] ${r.title} @ ${r.company_name}`);
    console.log(`        ${r.apply_url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
