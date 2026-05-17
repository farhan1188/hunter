import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const r1 = await db.execute(
    "SELECT COUNT(*) AS n FROM jobs WHERE archived = 0 AND visa_category IN ('international_remote','sponsorship_offered')",
  );
  console.log("Pakistan-eligible active jobs:", r1.rows[0].n);

  const r2 = await db.execute(
    "SELECT j.id, j.title, j.company_name, j.visa_category, s.value, (SELECT a.state FROM applications a WHERE a.job_id = j.id) AS app_state " +
    "FROM jobs j LEFT JOIN scores s ON s.job_id = j.id " +
    "WHERE j.archived = 0 AND j.visa_category IN ('international_remote','sponsorship_offered')",
  );
  for (const r of r2.rows) {
    console.log("  " + r.visa_category + " | " + r.title + " @ " + r.company_name + " | score=" + r.value + " | app=" + r.app_state);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
