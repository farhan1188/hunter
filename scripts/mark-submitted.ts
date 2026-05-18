// Generic "mark this job submitted" helper. Usage:
//   npx tsx scripts/mark-submitted.ts <job_id> "<note>"
import "dotenv/config";
import { getDb } from "@/src/db/client";
import { createQualified } from "@/src/core/applications/persist";

async function main() {
  const jobId = process.argv[2];
  const note = process.argv[3] ?? "MCP-driven Playwright submit; confirmation page reached";
  if (!jobId) { console.error("usage: mark-submitted <job_id> [note]"); process.exit(1); }
  const db = getDb();
  let id = await createQualified(db, jobId, "ats_native", "greenhouse");
  if (!id) {
    const r = await db.execute({ sql: "SELECT id FROM applications WHERE job_id = ?", args: [jobId] });
    id = (r.rows[0]?.id as string) ?? null;
  }
  if (!id) { console.error("no application id"); process.exit(1); }
  await db.execute({
    sql: "UPDATE applications SET state = 'submitted', submitted_at = datetime('now'), failure_reason = ? WHERE id = ?",
    args: [note, id],
  });
  console.log(`Marked submitted: job=${jobId} app=${id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
