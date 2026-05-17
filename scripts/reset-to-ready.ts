import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("usage: tsx scripts/reset-to-ready.ts <id> [<id> ...]");
    process.exit(1);
  }
  const db = getDb();
  for (const id of ids) {
    const r = await db.execute({
      sql: "UPDATE applications SET state='ready', failure_reason=NULL, failure_screenshot_path=NULL, updated_at=datetime('now') WHERE id = ?",
      args: [id],
    });
    console.log(`${id}: ${r.rowsAffected ? "reset" : "not found"}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
