import "dotenv/config";
import { getDb } from "@/src/db/client";
import { createQualified } from "@/src/core/applications/persist";

async function main() {
  const db = getDb();
  await db.execute("UPDATE jobs SET ats_vendor = 'greenhouse' WHERE id = '9691e3bc8bc6b532'");
  let id = await createQualified(db, "9691e3bc8bc6b532", "ats_native", "greenhouse");
  if (!id) {
    const r = await db.execute("SELECT id FROM applications WHERE job_id = '9691e3bc8bc6b532'");
    id = (r.rows[0]?.id as string) ?? null;
  }
  if (!id) { console.error("no application id"); process.exit(1); }
  await db.execute({
    sql: "UPDATE applications SET state = 'submitted', submitted_at = datetime('now'), failure_reason = 'MCP-driven Playwright submit; confirmation page reached, no captcha' WHERE id = ?",
    args: [id],
  });
  console.log("Canonical marked submitted, app id:", id);
}
main().catch((e) => { console.error(e); process.exit(1); });
