import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/src/db/client";
import { getProfile, getSettings } from "@/src/profile/store";
import { selectBullets } from "@/src/core/tailor/bullet-selection";
import { renderResumePdf } from "@/src/core/tailor/typst-render";
import {
  fetchAndSelectVerbatimPhrase,
} from "@/src/core/tailor/verbatim-phrase";
import { generateCoverLetter } from "@/src/core/tailor/cover-letter";
import { runQualityGates, allGatesPass } from "@/src/core/quality/gates";
import { transition } from "@/src/core/applications/persist";
import type { ApplicationChannel } from "@/src/core/applications/types";

const BATCH_SIZE = 5;
const TMP_DIR = path.resolve("./tmp");

interface AppRow {
  id: string;
  job_id: string;
  tailor_retries: number;
  ats_vendor: string | null;
  title: string;
  company_name: string;
  description_md: string;
  apply_url: string | null;
}

async function main() {
  await mkdir(TMP_DIR, { recursive: true });

  const db = getDb();
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);

  if (!profile.resume_struct) {
    throw new Error("No resume_struct on profile — upload a resume first.");
  }

  const { rows } = await db.execute({
    sql: `SELECT a.id, a.job_id, a.tailor_retries, a.ats_vendor,
                 j.title, j.company_name, j.description_md, j.apply_url
          FROM applications a
          JOIN jobs j ON j.id = a.job_id
          WHERE a.state = 'qualified' AND a.tailor_retries < 3
          LIMIT ?`,
    args: [BATCH_SIZE],
  });

  const apps = rows as unknown as AppRow[];
  console.log(`Processing ${apps.length} qualified application(s)...`);

  let processed = 0;
  let ready = 0;
  let qualityReview = 0;
  let errored = 0;

  const startedAt = new Date().toISOString();

  for (const app of apps) {
    processed++;
    const label = `${app.title} @ ${app.company_name}`;

    try {
      // a. Transition to tailoring
      await transition(db, app.id, "tailoring");

      // b. Select bullets
      const selectedBullets = selectBullets(
        profile.resume_struct!,
        app.description_md,
        8
      );

      // c. Render PDF
      const pdfBuffer = await renderResumePdf({
        basics: profile.basics,
        selected_bullets: selectedBullets,
        resume: profile.resume_struct!,
      });
      const pdfFilename = `resume-${app.id}.pdf`;
      const pdfPath = path.join(TMP_DIR, pdfFilename);
      await writeFile(pdfPath, pdfBuffer);

      // d. Verbatim phrase (may be null)
      const verbatim = app.apply_url
        ? await fetchAndSelectVerbatimPhrase(app.apply_url)
        : null;

      // e. Cover letter
      const coverLetter = await generateCoverLetter({
        profile_name: profile.basics.name ?? "",
        role_title: app.title,
        company_name: app.company_name,
        jd_summary: app.description_md.slice(0, 800),
        verbatim_phrase: verbatim?.phrase ?? "",
        max_words: settings.cover_letter_max_words,
      });

      // f. Build gates input
      // v1 simplification: tailored == original (no rewriting yet; claim-equiv trivially passes)
      const tailoredBullets = selectedBullets.map((b) => ({
        tailored: b.text,
        original: b.text,
        source_numbers: b.numbers,
      }));

      // g. Run quality gates
      const gates = await runQualityGates({
        tailored_bullets: tailoredBullets,
        cover_letter: coverLetter,
        verbatim_phrase: verbatim?.phrase ?? null,
      });

      // h/i. Transition based on gate outcome
      if (allGatesPass(gates)) {
        const atsNativeVendors = new Set(["greenhouse", "lever", "ashby"]);
        const channel: ApplicationChannel =
          app.ats_vendor && atsNativeVendors.has(app.ats_vendor)
            ? "ats_native"
            : "local_agent";

        await transition(db, app.id, "ready", {
          channel,
          resume_pdf_path: pdfFilename,
          cover_letter_md: coverLetter,
          quality_gates: gates,
        });
        ready++;
        console.log(`  [ready]          ${label}`);
      } else {
        await transition(db, app.id, "quality_review", {
          quality_gates: gates,
        });
        qualityReview++;
        console.log(`  [quality_review] ${label}`);
        if (gates.notes) console.log(`                   gates: ${gates.notes}`);
      }
    } catch (err) {
      errored++;
      console.error(`  [errored]        ${label}:`, err);

      // Bump tailor_retries; if >= 3, route to quality_review
      const newRetries = (app.tailor_retries ?? 0) + 1;
      try {
        if (newRetries >= 3) {
          // Force bump retries then transition to quality_review
          await db.execute({
            sql: `UPDATE applications SET tailor_retries = ?, updated_at = datetime('now') WHERE id = ?`,
            args: [newRetries, app.id],
          });
          // If still in 'tailoring' state, move to quality_review
          const cur = await db.execute({
            sql: "SELECT state FROM applications WHERE id = ?",
            args: [app.id],
          });
          if (cur.rows.length > 0 && cur.rows[0].state === "tailoring") {
            await transition(db, app.id, "quality_review");
          }
        } else {
          // Revert to qualified so it can be retried next run
          await db.execute({
            sql: `UPDATE applications SET tailor_retries = ?, state = 'qualified', updated_at = datetime('now') WHERE id = ?`,
            args: [newRetries, app.id],
          });
        }
      } catch (retryErr) {
        console.error(`  Failed to bump retries for ${app.id}:`, retryErr);
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const stats = { processed, ready, quality_review: qualityReview, errored };

  await db.execute({
    sql: `INSERT INTO routine_runs (routine, started_at, finished_at, ok, stats_json)
          VALUES ('tailor', ?, ?, 1, ?)`,
    args: [startedAt, finishedAt, JSON.stringify(stats)],
  });

  console.log(`\nDone. processed=${processed} ready=${ready} quality_review=${qualityReview} errored=${errored}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
