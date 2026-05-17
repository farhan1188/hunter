// Populate honest answers for work-auth / visa / sponsorship questions and
// drop the deny_list flag so the agent can submit applications to worldwide
// roles without halting. User is Pakistan-based; the honest answers are:
//   - Do you have US/UK/CA work auth?     -> No
//   - Do you require visa sponsorship?    -> Yes
// Risk: some "worldwide" roles secretly require US auth and will auto-reject.
// Acceptable trade-off — at least the application reaches the recruiter.

import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const updates: Array<[string, string]> = [
    ["work auth", "No"],
    ["work authorization", "No"],
    ["authorized to work", "No"],
    ["legal right to work", "No"],
    ["legally authorized", "No"],
    ["eligible to work", "No"],
    ["sponsor", "Yes"],
    ["sponsorship", "Yes"],
    ["visa", "Yes"],
    ["require sponsorship", "Yes"],
  ];
  for (const [pattern, answer] of updates) {
    const r = await db.execute({
      sql: "UPDATE qa_kb SET answer = ?, deny_list = 0 WHERE pattern = ?",
      args: [answer, pattern],
    });
    if (r.rowsAffected === 0) {
      await db.execute({
        sql: "INSERT INTO qa_kb (pattern, answer, deny_list) VALUES (?, ?, 0)",
        args: [pattern, answer],
      });
    }
  }
  const { rows } = await db.execute(
    "SELECT pattern, answer, deny_list FROM qa_kb WHERE pattern IN " +
    "('work auth','work authorization','authorized to work','legal right to work','legally authorized','eligible to work','sponsor','sponsorship','visa','require sponsorship') " +
    "ORDER BY pattern",
  );
  console.log("Updated QA KB:");
  for (const x of rows) console.log("  " + (x.deny_list ? "[DENY]" : "[OK]") + " | " + x.pattern + " => " + x.answer);
}
main().catch((e) => { console.error(e); process.exit(1); });
