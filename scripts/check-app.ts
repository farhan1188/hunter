import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const id = process.argv[2];
  if (!id) { console.error("usage: tsx scripts/check-app.ts <id>"); process.exit(1); }
  const db = getDb();
  const { rows } = await db.execute({
    sql: "SELECT id, state, submitted_at, failure_reason, failure_screenshot_path FROM applications WHERE id = ?",
    args: [id],
  });
  if (rows.length === 0) console.log("not found");
  else console.log(rows[0]);
}
main().catch((e) => { console.error(e); process.exit(1); });
