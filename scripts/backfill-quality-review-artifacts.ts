// One-shot: backfill cover_letter_md, resume_pdf_path, and quality_gates_json
// for apps already in quality_review whose artifacts/gates predate the bug fixes.
// --force: re-process even if fields are already populated. Safe to delete once
// no quality_review rows have stale artifacts.
import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { getProfile, getSettings } from "@/src/profile/store";
import { selectBullets } from "@/src/core/tailor/bullet-selection";
import { generateCoverLetter } from "@/src/core/tailor/cover-letter";
import { runQualityGates } from "@/src/core/quality/gates";

const TMP_DIR = path.resolve("./tmp");

async function main() {
  const db = getDb();
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);

  const force = process.argv.includes("--force");
  const { rows } = await db.execute(
    `SELECT a.id, a.job_id, j.title, j.company_name, j.description_md
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.state = 'quality_review'
       ${force ? "" : "AND (a.cover_letter_md IS NULL OR a.resume_pdf_path IS NULL)"}`,
  );

  console.log(`Backfilling ${rows.length} app(s)...`);

  for (const r of rows) {
    const id = r.id as string;
    const title = r.title as string;
    const company = r.company_name as string;
    const jd = (r.description_md as string) ?? "";

    const pdfFilename = `resume-${id}.pdf`;
    const pdfExists = existsSync(path.join(TMP_DIR, pdfFilename));

    const cover = await generateCoverLetter({
      profile_name: profile.basics.name ?? "",
      role_title: title,
      company_name: company,
      jd_summary: jd.slice(0, 800),
      verbatim_phrase: "",
      max_words: settings.cover_letter_max_words,
    });

    // Re-run gates against the relaxed logic (numerics + verbatim soft-pass)
    const selectedBullets = profile.resume_struct
      ? selectBullets(profile.resume_struct, jd, 8)
      : [];
    const gates = await runQualityGates({
      tailored_bullets: selectedBullets.map((b) => ({
        tailored: b.text,
        original: b.text,
        source_numbers: b.numbers,
      })),
      cover_letter: cover,
      verbatim_phrase: null,
      company_name: company,
      role_title: title,
    });

    await db.execute({
      sql: `UPDATE applications
            SET cover_letter_md = ?,
                resume_pdf_path = COALESCE(?, resume_pdf_path),
                quality_gates_json = ?,
                updated_at = datetime('now')
            WHERE id = ?`,
      args: [cover, pdfExists ? pdfFilename : null, JSON.stringify(gates), id],
    });

    console.log(`  [backfilled] ${title} @ ${company} (pdf=${pdfExists ? "yes" : "MISSING"}, gates=${gates.numerics}/${gates.claim_equiv}/${gates.verbatim_phrase})`);
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
