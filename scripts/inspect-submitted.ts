import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT a.id, j.company_name, j.title, a.state, a.submitted_at, a.failure_reason, a.failure_screenshot_path, a.qa_answers_json " +
    "FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.state='submitted' ORDER BY a.submitted_at DESC",
  );
  for (const r of rows) {
    console.log("===", r.company_name, "-", r.title, "===");
    console.log("  id:", r.id);
    console.log("  submitted_at:", r.submitted_at);
    console.log("  failure_reason:", r.failure_reason);
    console.log("  failure_screenshot_path:", r.failure_screenshot_path);
    const raw = r.qa_answers_json as string | null;
    if (raw) {
      const qa = JSON.parse(raw);
      const log = Array.isArray(qa) ? qa : qa.qa_log;
      console.log("  qa entries:", log?.length ?? 0);
      if (log) for (const e of log) console.log("    -", e.question, "=>", String(e.answer).slice(0, 100));
    } else {
      console.log("  qa_answers_json: null");
    }
    console.log();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
