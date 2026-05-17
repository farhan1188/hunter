import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, a.submitted_at, j.title, j.company_name, j.apply_url FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.state='submitted' ORDER BY a.submitted_at DESC",
  );
  console.log(`Submitted: ${rows.length}`);
  for (const r of rows) {
    console.log(`  ${r.submitted_at}  -  ${r.title} @ ${r.company_name}`);
    console.log(`     url: ${r.apply_url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
