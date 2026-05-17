import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT a.id, j.title, j.company_name, j.apply_url FROM applications a
       JOIN jobs j ON j.id = a.job_id
      WHERE a.state = 'ready' AND j.apply_url LIKE '%gh_jid%'`,
  );
  for (const r of rows) {
    console.log(r.id, '-', r.title, '@', r.company_name);
    console.log('   ', r.apply_url);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
