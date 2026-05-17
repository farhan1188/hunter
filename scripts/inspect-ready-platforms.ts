import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT a.id, a.channel, a.ats_vendor, j.title, j.company_name, j.apply_url
       FROM applications a JOIN jobs j ON j.id = a.job_id
      WHERE a.state = 'ready'
      ORDER BY j.ats_vendor`,
  );
  for (const r of rows) {
    const url = r.apply_url as string;
    let platform = "other";
    if (/myworkdayjobs/.test(url)) platform = "workday";
    else if (/greenhouse/.test(url)) platform = "greenhouse";
    else if (/lever\.co/.test(url)) platform = "lever";
    else if (/ashbyhq/.test(url)) platform = "ashby";
    else if (/linkedin\.com/.test(url)) platform = "linkedin";
    console.log(`${platform.padEnd(10)} | ${r.id} | ${r.title} @ ${r.company_name}`);
    console.log(`           url: ${url}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
