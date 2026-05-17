import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT a.id, a.state, a.cover_letter_md, j.title, j.company_name
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.state = 'ready' AND a.updated_at > datetime('now','-30 minutes')
     ORDER BY a.updated_at DESC`,
  );
  for (const r of rows) {
    console.log(`\n=== ${r.title} @ ${r.company_name} ===`);
    console.log(`id: ${r.id}`);
    console.log(`---`);
    console.log(r.cover_letter_md);
    console.log(`---`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
