import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, j.title, j.company_name, j.location_raw, j.visa_category, j.apply_url, substr(j.description_md,1,800) as desc_excerpt FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.state='ready' ORDER BY a.created_at",
  );
  for (const r of rows) {
    console.log("=== ", r.company_name, " - ", r.title, " ===");
    console.log("  app_id:", r.id);
    console.log("  location_raw:", r.location_raw);
    console.log("  visa_category:", r.visa_category);
    console.log("  apply_url:", r.apply_url);
    console.log("  desc:", String(r.desc_excerpt).replace(/\s+/g, " ").slice(0, 500));
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
