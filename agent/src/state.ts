import { createClient, type Client } from "@libsql/client";

export interface ReadyApplication {
  id: string;
  job_id: string;
  title: string;
  company_name: string;
  apply_url: string;
  ats_vendor: string | null;
  resume_pdf_path: string | null;
  cover_letter_md: string | null;
  qa_answers_json: string;
}

export function getAgentDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const auth = process.env.TURSO_AUTH_TOKEN_AGENT;
  if (!url || !auth) throw new Error("TURSO_DATABASE_URL + TURSO_AUTH_TOKEN_AGENT required");
  return createClient({ url, authToken: auth });
}

function rowToApp(r: Record<string, unknown>): ReadyApplication {
  return {
    id: r.id as string,
    job_id: r.job_id as string,
    title: r.title as string,
    company_name: r.company_name as string,
    apply_url: r.apply_url as string,
    ats_vendor: (r.ats_vendor as string) || null,
    resume_pdf_path: (r.resume_pdf_path as string) || null,
    cover_letter_md: (r.cover_letter_md as string) || null,
    qa_answers_json: (r.qa_answers_json as string) || "[]",
  };
}

/** Pick the next ready application destined for the Local Agent (non-ATS or click_to_send). */
export async function pickNextReady(db: Client): Promise<ReadyApplication | null> {
  const { rows } = await db.execute(`
    SELECT a.id, a.job_id, a.resume_pdf_path, a.cover_letter_md, a.ats_vendor, a.qa_answers_json,
           j.title, j.company_name, j.apply_url
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
     WHERE a.state = 'ready' AND a.channel = 'local_agent'
  ORDER BY a.created_at ASC
     LIMIT 1
  `);
  if (rows.length === 0) return null;
  return rowToApp(rows[0] as unknown as Record<string, unknown>);
}

/** Fetch a specific ready application by id (for per-app agent runs). */
export async function getReadyById(db: Client, applicationId: string): Promise<ReadyApplication | null> {
  const { rows } = await db.execute({
    sql: `SELECT a.id, a.job_id, a.resume_pdf_path, a.cover_letter_md, a.ats_vendor, a.qa_answers_json,
                 j.title, j.company_name, j.apply_url
            FROM applications a
            JOIN jobs j ON j.id = a.job_id
           WHERE a.id = ? AND a.state = 'ready'
           LIMIT 1`,
    args: [applicationId],
  });
  if (rows.length === 0) return null;
  return rowToApp(rows[0] as unknown as Record<string, unknown>);
}

export async function markSubmitted(db: Client, applicationId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE applications SET state = 'submitted', submitted_at = datetime('now'),
                                   updated_at = datetime('now') WHERE id = ?`,
    args: [applicationId],
  });
}

export async function markFailed(
  db: Client,
  applicationId: string,
  reason: string,
  screenshotPath: string | null
): Promise<void> {
  await db.execute({
    sql: `UPDATE applications SET state = 'submit_failed',
                                   failure_reason = ?, failure_screenshot_path = ?,
                                   updated_at = datetime('now')
            WHERE id = ?`,
    args: [reason, screenshotPath, applicationId],
  });
}
