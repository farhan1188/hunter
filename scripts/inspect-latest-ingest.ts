import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT j.id, j.title, j.company_name, j.ats_vendor, j.apply_url, j.url, s.value AS score
       FROM jobs j LEFT JOIN scores s ON s.job_id = j.id
      WHERE j.fetched_at > datetime('now','-10 minute')
      ORDER BY s.value DESC NULLS LAST`,
  );
  for (const r of rows) {
    const isLi = (r.apply_url as string) === (r.url as string);
    const isExternal = !isLi && (r.apply_url as string)?.length > 0;
    const tag = isExternal ? `[EXTERNAL ${r.ats_vendor ?? "?"}]` : `[linkedin]`;
    console.log(`${String(r.score).padStart(3)} ${tag.padEnd(22)} ${r.title} @ ${r.company_name}`);
    console.log(`     ${r.apply_url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
