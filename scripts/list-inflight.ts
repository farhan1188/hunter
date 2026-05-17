import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, a.state, j.title, j.company_name, j.visa_category, j.apply_url FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.state IN ('qualified','tailoring','quality_review','ready')",
  );
  for (const r of rows) console.log(r.state + " | " + r.visa_category + " | " + r.title + " @ " + r.company_name + " | " + r.apply_url);
  console.log("Total:", rows.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
