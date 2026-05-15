// src/core/applications/persist.ts
import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import type {
  Application,
  ApplicationState,
  ApplicationChannel,
  QualityGates,
} from "./types";
import { assertValidTransition } from "./transitions";

/**
 * Create a new application in `qualified` state for a job. Idempotent on job_id
 * thanks to the UNIQUE constraint — returns the existing row's id if one exists.
 */
export async function createQualified(
  db: Client,
  jobId: string,
  channel: ApplicationChannel | null,
  atsVendor: string | null
): Promise<string> {
  const existing = await db.execute({
    sql: "SELECT id FROM applications WHERE job_id = ?",
    args: [jobId],
  });
  if (existing.rows.length > 0) return existing.rows[0].id as string;

  const id = randomUUID();
  await db.execute({
    sql: `INSERT INTO applications (id, job_id, state, channel, ats_vendor)
          VALUES (?, ?, 'qualified', ?, ?)`,
    args: [id, jobId, channel, atsVendor],
  });
  return id;
}

/**
 * Transition an application to a new state, asserting validity first.
 * Use the patch parameter to set fields written by the transition (e.g.
 * resume_pdf_path when moving to 'ready', failure_reason when moving to
 * 'submit_failed').
 */
export async function transition(
  db: Client,
  applicationId: string,
  toState: ApplicationState,
  patch: Partial<{
    channel: ApplicationChannel;
    ats_vendor: string;
    resume_pdf_path: string;
    cover_letter_md: string;
    quality_gates: QualityGates;
    failure_reason: string;
    failure_screenshot_path: string;
    tailor_retries: number;
    submitted_at: string;
  }> = {}
): Promise<void> {
  const cur = await db.execute({
    sql: "SELECT state FROM applications WHERE id = ?",
    args: [applicationId],
  });
  if (cur.rows.length === 0) throw new Error(`application not found: ${applicationId}`);
  const from = cur.rows[0].state as ApplicationState;
  assertValidTransition(from, toState);

  const sets: string[] = ["state = ?", "updated_at = datetime('now')"];
  const args: (string | number | null)[] = [toState];

  if (patch.channel !== undefined)                 { sets.push("channel = ?");                   args.push(patch.channel); }
  if (patch.ats_vendor !== undefined)              { sets.push("ats_vendor = ?");                args.push(patch.ats_vendor); }
  if (patch.resume_pdf_path !== undefined)         { sets.push("resume_pdf_path = ?");           args.push(patch.resume_pdf_path); }
  if (patch.cover_letter_md !== undefined)         { sets.push("cover_letter_md = ?");           args.push(patch.cover_letter_md); }
  if (patch.quality_gates !== undefined)           { sets.push("quality_gates_json = ?");        args.push(JSON.stringify(patch.quality_gates)); }
  if (patch.failure_reason !== undefined)          { sets.push("failure_reason = ?");            args.push(patch.failure_reason); }
  if (patch.failure_screenshot_path !== undefined) { sets.push("failure_screenshot_path = ?");   args.push(patch.failure_screenshot_path); }
  if (patch.tailor_retries !== undefined)          { sets.push("tailor_retries = ?");            args.push(patch.tailor_retries); }
  if (patch.submitted_at !== undefined)            { sets.push("submitted_at = ?");              args.push(patch.submitted_at); }

  args.push(applicationId);
  await db.execute({
    sql: `UPDATE applications SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

/**
 * Mark applications as closed when their underlying job rows are closed at source.
 * Called by the existing auto-close logic in the Ingest routine.
 */
export async function closeForJobs(db: Client, jobIds: string[]): Promise<number> {
  if (jobIds.length === 0) return 0;
  const ph = jobIds.map(() => "?").join(",");
  const res = await db.execute({
    sql: `UPDATE applications SET state = 'closed', updated_at = datetime('now')
          WHERE job_id IN (${ph}) AND state NOT IN ('submitted', 'submit_failed', 'closed', 'dismissed')`,
    args: jobIds,
  });
  return res.rowsAffected;
}
