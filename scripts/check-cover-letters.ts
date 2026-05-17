import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    "SELECT j.title, j.company_name, a.cover_letter_md FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.cover_letter_md IS NOT NULL",
  );
  let dashes = 0;
  let tells = 0;
  for (const r of rows) {
    const t = r.cover_letter_md as string;
    if (/[—–]/.test(t)) {
      dashes++;
      console.log(`  DASH: ${r.title} @ ${r.company_name}`);
    }
    const tellMatch = t.match(/I am writing to express|passion for|cutting.edge|leverage|synergy|delve|robust|best-in-class|world-class|moreover|furthermore|in conclusion|I would welcome the opportunity/i);
    if (tellMatch) {
      tells++;
      console.log(`  TELL "${tellMatch[0]}": ${r.title} @ ${r.company_name}`);
    }
  }
  console.log(`\n${rows.length} letters checked, ${dashes} with dashes, ${tells} with LLM tells`);
}
main().catch((e) => { console.error(e); process.exit(1); });
