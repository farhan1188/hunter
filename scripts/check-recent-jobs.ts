import "dotenv/config";
import { getProfile } from "@/src/profile/store";

async function main() {
  const p = await getProfile();
  if (!p.resume_struct) { console.log("no resume_struct"); return; }
  console.log("summary:", JSON.stringify((p.resume_struct as any).summary ?? ""));
  console.log();
  console.log("experiences:");
  for (const e of p.resume_struct.experience) {
    console.log(`  ${e.company} | ${e.title} | ${e.start} → ${e.end ?? "present"} (${e.bullets.length} bullets)`);
  }
  console.log();
  console.log("projects:");
  for (const pr of p.resume_struct.projects) {
    console.log(`  ${pr.name} (${pr.bullets.length} bullets)`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
