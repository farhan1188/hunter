import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, j.company_name, j.title, j.location_raw, j.location_remote, j.visa_category, j.visa_target_countries_json " +
    "FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.state='submitted' ORDER BY a.submitted_at DESC",
  );
  for (const r of rows) {
    console.log(`${r.company_name} — ${r.title}`);
    console.log(`  location: ${r.location_raw}`);
    console.log(`  visa_category: ${r.visa_category}`);
    console.log(`  location_remote: ${r.location_remote}`);
    console.log(`  visa_target_countries: ${r.visa_target_countries_json}`);
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
