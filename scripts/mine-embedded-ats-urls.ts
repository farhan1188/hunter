// WeWorkRemotely / Jobicy / Himalayas / WorkingNomads use listing pages as
// apply_url. But many JD bodies include a direct link to the company's real
// ATS (greenhouse/lever/ashby/workable/etc.) inside the description. Scan for
// those and patch apply_url so the existing filler can hit them.

import "dotenv/config";
import { getDb } from "@/src/db/client";

const ATS_RE = new RegExp(
  "\\bhttps?:\\/\\/[^\\s)>'\\\"]*" +
  "(?:greenhouse\\.io|jobs\\.lever\\.co|ashbyhq\\.com|jobs\\.workable\\.com|" +
  "apply\\.workable\\.com|myworkdayjobs\\.com|smartrecruiters\\.com|" +
  "bamboohr\\.com\\/jobs|recruitee\\.com\\/o|breezy\\.hr|" +
  "teamtailor\\.com\\/jobs|jobvite\\.com|icims\\.com|taleo\\.net|" +
  "[?&]gh_jid=)" +
  "[^\\s)>'\\\"]*",
  "gi",
);

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT id, company_name, title, source, apply_url, description_md FROM jobs WHERE archived = 0",
  );
  console.log(`Scanning ${rows.length} active jobs...`);

  let candidates = 0;
  let patched = 0;
  for (const r of rows) {
    const matches = (r.description_md as string).match(ATS_RE);
    if (!matches || matches.length === 0) continue;
    const newUrl = matches[0];
    const oldUrl = r.apply_url as string;
    // Skip if already pointing at a real ATS
    if (/greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs\.com|gh_jid=/i.test(oldUrl)) continue;
    candidates++;
    console.log(`  ${r.source} | ${r.company_name} | ${r.title}`);
    console.log(`    OLD: ${oldUrl}`);
    console.log(`    NEW: ${newUrl}`);
    if (apply) {
      await db.execute({
        sql: "UPDATE jobs SET apply_url = ? WHERE id = ?",
        args: [newUrl, r.id as string],
      });
      patched++;
    }
  }
  console.log(`\nFound ${candidates} jobs with embedded ATS URLs.`);
  if (apply) console.log(`Patched ${patched} apply_url fields.`);
  else console.log(`Dry-run. Add --apply to write.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
