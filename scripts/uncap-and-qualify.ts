// Lower score threshold + qualify any high-promise jobs sitting unqualified.
// Removes all caps for the live test.
import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getSettings, saveSettings } from "@/src/profile/store";
import { createQualified } from "@/src/core/applications/persist";

async function main() {
  const db = getDb();
  const cur = await getSettings();
  await saveSettings({
    ...cur,
    submission_paused: false,
    autonomous_auto_submit: true,
    daily_cap: 0,    // no cap
    weekly_cap: 0,   // no cap
    score_threshold: 50, // widen the net for the test
  });
  console.log("settings: pause=OFF, auto_submit=ON, daily_cap=0, weekly_cap=0, score_threshold=50");

  // Qualify any scored job that's NOT yet in applications and crosses the new threshold.
  const { rows } = await db.execute(
    `SELECT j.id, j.title, j.company_name, j.ats_vendor, s.value
       FROM jobs j JOIN scores s ON s.job_id = j.id
       LEFT JOIN applications a ON a.job_id = j.id
      WHERE a.id IS NULL AND s.value >= 50
      ORDER BY s.value DESC`,
  );
  console.log(`Found ${rows.length} unqualified scored jobs above 50.`);
  for (const r of rows) {
    const ats = r.ats_vendor as string | null;
    await createQualified(db, r.id as string, null, ats);
    console.log(`  qualified: ${r.title} @ ${r.company_name} (${r.value})`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
