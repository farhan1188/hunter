import "dotenv/config";
import { getProfile } from "@/src/profile/store";

async function main() {
  const p = await getProfile();
  const r = p.resume_struct;
  if (!r) { console.error("no resume struct"); process.exit(1); }
  const lines: string[] = [];
  lines.push("Farhan Ahmed Khan");
  lines.push("farhan1188@gmail.com | +92 334 369 4022 | Karachi, Pakistan");
  lines.push("https://linkedin.com/in/farhanahmedkhan22");
  lines.push("");
  lines.push("SUMMARY");
  lines.push(r.summary ?? "");
  lines.push("");
  lines.push("EXPERIENCE");
  for (const e of r.experience) {
    lines.push(`${e.title}, ${e.company} (${e.start} to ${e.end ?? "present"})`);
    for (const b of e.bullets) lines.push(`  - ${b.text}`);
    lines.push("");
  }
  lines.push("EDUCATION");
  for (const ed of r.education) lines.push(`  ${ed.degree}, ${ed.school} (${ed.year})`);
  lines.push("");
  lines.push("SKILLS");
  lines.push(`Primary: ${r.skills.primary.join(", ")}`);
  lines.push(`Secondary: ${r.skills.secondary.join(", ")}`);
  if (r.projects?.length) {
    lines.push("");
    lines.push("PROJECTS");
    for (const pr of r.projects) {
      lines.push(`  ${pr.name}`);
      for (const b of pr.bullets) lines.push(`    - ${b.text}`);
    }
  }
  console.log(lines.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
