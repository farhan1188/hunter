import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT title, location_raw, visa_category, substr(description_md, 1, 1000) as d FROM jobs WHERE source='greenhouse' AND company_name='gitlab' AND archived=0 LIMIT 5",
  );
  for (const row of rows) {
    console.log(row.visa_category + " | " + row.title);
    console.log("  loc: " + row.location_raw);
    console.log("  desc: " + String(row.d).replace(/\s+/g, " ").slice(0, 800));
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
