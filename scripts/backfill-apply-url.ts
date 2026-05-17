import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const r = await db.execute("UPDATE jobs SET apply_url = url WHERE apply_url IS NULL");
  console.log(`Backfilled apply_url on ${r.rowsAffected} jobs.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
