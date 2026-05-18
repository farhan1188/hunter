import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT id, title, apply_url FROM jobs WHERE company_name = 'canonical' AND archived = 0 " +
    "AND visa_category = 'international_remote' " +
    "AND id != '9691e3bc8bc6b532' " +
    "AND (title LIKE '%Solutions Architect%' OR title LIKE '%Sales Engineer%' OR " +
    "title LIKE '%Engineering Manager%' OR title LIKE '%Technical Author%' OR " +
    "title LIKE '%Partner Sales%' OR title LIKE '%Solution Architecture%' OR " +
    "title LIKE '%Solution%') " +
    "LIMIT 8",
  );
  for (const r of rows) {
    console.log(`${r.id} | ${r.title}`);
    console.log(`  ${r.apply_url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
