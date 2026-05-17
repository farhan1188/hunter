import "dotenv/config";
import { getProfile } from "@/src/profile/store";

async function main() {
  const p = await getProfile();
  if (!p.resume_struct) { console.log("no resume_struct"); return; }
  const re = /\d[\d,.\-]*/g;
  let totalBullets = 0;
  let bulletsWithDigits = 0;
  let bulletsWithMissing = 0;
  for (const exp of p.resume_struct.experience) {
    for (const b of exp.bullets) {
      totalBullets++;
      const digits = b.text.match(re);
      if (!digits || digits.length === 0) continue;
      bulletsWithDigits++;
      const allowed = new Set((b.numbers ?? []).map((n) => n.trim()));
      const missing = digits.map((d) => d.replace(/[,.\-]+$/, "")).filter((d) => !allowed.has(d));
      if (missing.length > 0) {
        bulletsWithMissing++;
        console.log(`MISSING: ${JSON.stringify(missing)} | numbers[]=${JSON.stringify(b.numbers)}`);
        console.log(`  text: ${b.text.slice(0, 140)}`);
      }
    }
  }
  console.log(`\nbullets total=${totalBullets} with-digits=${bulletsWithDigits} with-missing=${bulletsWithMissing}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
