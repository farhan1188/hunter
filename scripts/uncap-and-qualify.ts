// Lower the score threshold and qualify any high-promise jobs sitting unqualified.
// Removes the daily/weekly submission caps for testing.
//
// Pakistan-safe: only qualifies jobs whose visa_category is
// 'international_remote' or 'sponsorship_offered'. The createQualified() gate
// enforces this too, but filtering in SQL keeps the log honest.
import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getSettings, saveSettings } from "@/src/profile/store";
import {
  createQualified,
  ELIGIBLE_VISA_CATEGORIES,
} from "@/src/core/applications/persist";

async function main() {
  const db = getDb();
  const cur = await getSettings();
  await saveSettings({
    ...cur,
    submission_paused: false,
    autonomous_auto_submit: true,
    daily_cap: 0,
    weekly_cap: 0,
    score_threshold: 50,
  });
  console.log("settings: pause=OFF, auto_submit=ON, daily_cap=0, weekly_cap=0, score_threshold=50");

  const ph = ELIGIBLE_VISA_CATEGORIES.map(() => "?").join(",");
  const { rows } = await db.execute({
    sql: `SELECT j.id, j.title, j.company_name, j.ats_vendor, j.visa_category, s.value
            FROM jobs j JOIN scores s ON s.job_id = j.id
            LEFT JOIN applications a ON a.job_id = j.id
           WHERE a.id IS NULL
             AND s.value >= 50
             AND j.archived = 0
             AND j.visa_category IN (${ph})
           ORDER BY s.value DESC`,
    args: [...ELIGIBLE_VISA_CATEGORIES],
  });
  console.log(`Found ${rows.length} eligible unqualified scored jobs above 50.`);

  let qualified = 0;
  let skipped = 0;
  for (const r of rows) {
    const ats = r.ats_vendor as string | null;
    const appId = await createQualified(db, r.id as string, null, ats);
    if (appId) {
      qualified++;
      console.log(`  qualified [${r.visa_category}]: ${r.title} @ ${r.company_name} (${r.value})`);
    } else {
      skipped++;
      console.log(`  SKIPPED [${r.visa_category}]: ${r.title} @ ${r.company_name} — gate rejected`);
    }
  }
  console.log(`\nQualified ${qualified}, skipped ${skipped}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
