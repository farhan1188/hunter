import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT j.id, j.title, j.company_name, j.apply_url, s.value " +
    "FROM jobs j JOIN scores s ON s.job_id = j.id " +
    "WHERE j.archived = 0 AND j.visa_category IN ('international_remote','sponsorship_offered') " +
    "AND j.company_name != 'canonical' " +
    "ORDER BY s.value DESC LIMIT 15",
  );
  for (const r of rows) {
    console.log(`${r.value} | ${r.company_name} | ${r.title}`);
    console.log(`     ${r.apply_url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
