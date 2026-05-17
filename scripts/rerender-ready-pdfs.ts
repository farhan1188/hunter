// Re-render the resume PDF for every application in `ready` / `quality_review`
// using the current resume_struct + current typst-render logic. Useful after
// changing the template, the renderer, or the resume content.
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { getProfile } from "@/src/profile/store";
import { selectBullets } from "@/src/core/tailor/bullet-selection";
import { renderResumePdf } from "@/src/core/tailor/typst-render";

const TMP_DIR = path.resolve("./tmp");

async function main() {
  await mkdir(TMP_DIR, { recursive: true });
  const db = getDb();
  const profile = await getProfile();
  if (!profile.resume_struct) throw new Error("no resume_struct on profile");

  const { rows } = await db.execute(
    `SELECT a.id, j.description_md
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.state IN ('ready', 'quality_review')`,
  );
  console.log(`Re-rendering ${rows.length} PDFs...`);

  for (const r of rows) {
    const id = r.id as string;
    const jd = (r.description_md as string) ?? "";
    const selected = selectBullets(profile.resume_struct!, jd, 8);
    const pdf = await renderResumePdf({
      basics: profile.basics,
      selected_bullets: selected,
      resume: profile.resume_struct!,
    });
    const filename = `resume-${id}.pdf`;
    await writeFile(path.join(TMP_DIR, filename), pdf);
    // Make sure the path is on the row (was missing for some earlier backfills).
    await db.execute({
      sql: "UPDATE applications SET resume_pdf_path = ? WHERE id = ?",
      args: [filename, id],
    });
    console.log(`  ${id} (${pdf.length} bytes)`);
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
