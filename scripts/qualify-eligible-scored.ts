import "dotenv/config";
import { getDb } from "@/src/db/client";
import { createQualified } from "@/src/core/applications/persist";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT j.id, j.title, j.company_name, j.ats_vendor, j.visa_category, s.value " +
    "FROM jobs j JOIN scores s ON s.job_id = j.id LEFT JOIN applications a ON a.job_id = j.id " +
    "WHERE a.id IS NULL AND j.archived = 0 " +
    "  AND j.visa_category IN ('international_remote','sponsorship_offered')",
  );
  console.log(`Found ${rows.length} scored Pakistan-eligible jobs without apps.`);
  let qualified = 0;
  let rejected = 0;
  for (const r of rows) {
    const id = await createQualified(db, r.id as string, null, r.ats_vendor as string | null);
    if (id) {
      qualified++;
      console.log(`  qualified: ${r.title} @ ${r.company_name} (score=${r.value})`);
    } else {
      rejected++;
      console.log(`  GATE rejected: ${r.title} @ ${r.company_name}`);
    }
  }
  console.log(`Done. qualified=${qualified} rejected=${rejected}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
