// Force-refresh existing RJF-sourced jobs: pull the latest description from
// the Greenhouse boards-api (where applicable) and overwrite the in-DB
// description so the classifier sees the authoritative JD on next pass.
// Also resets visa_category to 'unknown' for those rows so they get
// re-classified, and clears any prior score so process-pending picks them
// up again.

import "dotenv/config";
import { getDb } from "@/src/db/client";

async function fetchGreenhouseJd(jobUrl: string): Promise<{ description: string; locationRaw: string } | null> {
  const m = jobUrl.match(/greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const [, token, jobId] = m;
  try {
    const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${jobId}?questions=false`);
    if (!r.ok) return null;
    const data = await r.json() as { content?: string; location?: { name?: string } };
    const desc = (data.content ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const loc = data.location?.name ?? "";
    return { description: `Location: ${loc}\n\n${desc}`, locationRaw: loc };
  } catch { return null; }
}

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT id, apply_url, url, company_name, title FROM jobs WHERE archived = 0 AND external_id LIKE 'rjf-%'",
  );
  console.log(`Refreshing ${rows.length} RJF jobs...`);
  let refreshed = 0;
  let skipped = 0;
  for (const r of rows) {
    const jd = await fetchGreenhouseJd((r.apply_url as string) || (r.url as string));
    if (!jd) { skipped++; continue; }
    await db.execute({
      sql: "UPDATE jobs SET description_md = ?, location_raw = ?, visa_category = 'unknown', visa_target_countries_json = '[]' WHERE id = ?",
      args: [jd.description, jd.locationRaw || (r as { location_raw?: string }).location_raw || "Remote", r.id as string],
    });
    // Drop any existing score so process-pending re-evaluates.
    await db.execute({ sql: "DELETE FROM scores WHERE job_id = ?", args: [r.id as string] });
    refreshed++;
    console.log(`  refreshed: ${r.company_name} | ${r.title} | loc=${jd.locationRaw}`);
  }
  console.log(`\nDone. refreshed=${refreshed} skipped=${skipped}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
