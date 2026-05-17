// src/core/applications/query.ts
import type { Client } from "@libsql/client";
import type { ApplicationState } from "./types";

export interface PipelineRow {
  id: string;
  job_id: string;
  state: ApplicationState;
  channel: string | null;
  ats_vendor: string | null;
  failure_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from jobs.
  title: string;
  company_name: string;
  source: string;
  url: string;
  apply_url: string | null;
  posted_at: string;
  location_raw: string | null;
  location_remote: boolean;
  // Joined from scores.
  score: number | null;
  score_reasoning: string | null;
}

/** Fetch rows for the Pipeline UI, optionally filtered by state. */
export async function listPipeline(
  db: Client,
  states?: ApplicationState[]
): Promise<PipelineRow[]> {
  const stateClause = states && states.length > 0
    ? `AND a.state IN (${states.map(() => "?").join(",")})`
    : "";
  const args = states ?? [];
  const { rows } = await db.execute({
    sql: `SELECT
            a.id, a.job_id, a.state, a.channel, a.ats_vendor,
            a.failure_reason, a.submitted_at, a.created_at, a.updated_at,
            j.title, j.company_name, j.source, j.url, j.apply_url, j.posted_at,
            j.location_raw, j.location_remote,
            s.value AS score, s.reasoning AS score_reasoning
          FROM applications a
          JOIN jobs j ON j.id = a.job_id
          LEFT JOIN scores s ON s.job_id = a.job_id
          WHERE 1=1 ${stateClause}
          ORDER BY a.updated_at DESC
          LIMIT 500`,
    args,
  });
  return rows.map((r) => ({
    id: r.id as string,
    job_id: r.job_id as string,
    state: r.state as ApplicationState,
    channel: (r.channel as string) || null,
    ats_vendor: (r.ats_vendor as string) || null,
    failure_reason: (r.failure_reason as string) || null,
    submitted_at: (r.submitted_at as string) || null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    title: r.title as string,
    company_name: r.company_name as string,
    source: r.source as string,
    url: r.url as string,
    apply_url: (r.apply_url as string) || null,
    posted_at: r.posted_at as string,
    location_raw: (r.location_raw as string) || null,
    location_remote: Number(r.location_remote) === 1,
    score: r.score !== null ? (r.score as number) : null,
    score_reasoning: (r.score_reasoning as string) || null,
  }));
}

export interface ApplicationDetail extends PipelineRow {
  resume_pdf_path: string | null;
  cover_letter_md: string | null;
  qa_answers: Array<{ question: string; answer: string }>;
  quality_gates: unknown;
  failure_screenshot_path: string | null;
  description_md: string;
}

export async function getApplicationDetail(
  db: Client,
  id: string
): Promise<ApplicationDetail | null> {
  const { rows } = await db.execute({
    sql: `SELECT
            a.id, a.job_id, a.state, a.channel, a.ats_vendor,
            a.resume_pdf_path, a.cover_letter_md, a.qa_answers_json, a.quality_gates_json,
            a.failure_reason, a.failure_screenshot_path, a.submitted_at,
            a.created_at, a.updated_at,
            j.title, j.company_name, j.source, j.url, j.apply_url,
            j.description_md, j.posted_at, j.location_raw, j.location_remote,
            s.value AS score, s.reasoning AS score_reasoning
          FROM applications a
          JOIN jobs j ON j.id = a.job_id
          LEFT JOIN scores s ON s.job_id = a.job_id
          WHERE a.id = ?`,
    args: [id],
  });
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    job_id: r.job_id as string,
    state: r.state as ApplicationState,
    channel: (r.channel as string) || null,
    ats_vendor: (r.ats_vendor as string) || null,
    failure_reason: (r.failure_reason as string) || null,
    submitted_at: (r.submitted_at as string) || null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    title: r.title as string,
    company_name: r.company_name as string,
    source: r.source as string,
    url: r.url as string,
    apply_url: (r.apply_url as string) || null,
    posted_at: r.posted_at as string,
    location_raw: (r.location_raw as string) || null,
    location_remote: Number(r.location_remote) === 1,
    score: r.score !== null ? (r.score as number) : null,
    score_reasoning: (r.score_reasoning as string) || null,
    resume_pdf_path: (r.resume_pdf_path as string) || null,
    cover_letter_md: (r.cover_letter_md as string) || null,
    qa_answers: JSON.parse((r.qa_answers_json as string) || "[]"),
    quality_gates: r.quality_gates_json ? JSON.parse(r.quality_gates_json as string) : null,
    failure_screenshot_path: (r.failure_screenshot_path as string) || null,
    description_md: r.description_md as string,
  };
}

export interface DashboardStats {
  last_24h: {
    jobs_ingested: number;
    applications_created: number;
    submitted: number;
  };
  current: {
    ready: number;
    quality_review: number;
    tailoring: number;
    qualified: number;
    submit_failed_24h: number;
  };
  trend_7d: Array<{ date: string; jobs_ingested: number; submitted: number }>;
}

export async function getDashboardStats(db: Client): Promise<DashboardStats> {
  const oneDay = `datetime('now', '-1 day')`;
  const sevenDays = `datetime('now', '-7 day')`;

  const [
    jobsIngested24h,
    appsCreated24h,
    submitted24h,
    submitFailed24h,
    currentCounts,
    trendRows,
  ] = await Promise.all([
    db.execute(`SELECT COUNT(*) AS n FROM jobs WHERE fetched_at >= ${oneDay}`),
    db.execute(`SELECT COUNT(*) AS n FROM applications WHERE created_at >= ${oneDay}`),
    db.execute(`SELECT COUNT(*) AS n FROM applications WHERE submitted_at >= ${oneDay}`),
    db.execute(`SELECT COUNT(*) AS n FROM applications WHERE state = 'submit_failed' AND updated_at >= ${oneDay}`),
    db.execute(`SELECT state, COUNT(*) AS n FROM applications GROUP BY state`),
    db.execute(`
      SELECT date(fetched_at) AS d,
             COUNT(*) AS jobs_n,
             (SELECT COUNT(*) FROM applications a WHERE date(a.submitted_at) = date(j.fetched_at)) AS sub_n
      FROM jobs j
      WHERE fetched_at >= ${sevenDays}
      GROUP BY date(fetched_at)
      ORDER BY d DESC
    `),
  ]);

  const counts: Record<string, number> = {};
  for (const r of currentCounts.rows) counts[r.state as string] = r.n as number;

  return {
    last_24h: {
      jobs_ingested: (jobsIngested24h.rows[0]?.n as number) ?? 0,
      applications_created: (appsCreated24h.rows[0]?.n as number) ?? 0,
      submitted: (submitted24h.rows[0]?.n as number) ?? 0,
    },
    current: {
      ready: counts.ready ?? 0,
      quality_review: counts.quality_review ?? 0,
      tailoring: counts.tailoring ?? 0,
      qualified: counts.qualified ?? 0,
      submit_failed_24h: (submitFailed24h.rows[0]?.n as number) ?? 0,
    },
    trend_7d: trendRows.rows.map((r) => ({
      date: r.d as string,
      jobs_ingested: r.jobs_n as number,
      submitted: (r.sub_n as number) ?? 0,
    })),
  };
}
