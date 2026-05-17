import type { Client } from "@libsql/client";
import type { JobPosting, AdapterName } from "../types";

/**
 * Insert new job postings; for ones already present (unique on source+external_id),
 * bump `last_seen_at` and reopen any that were closed. Returns count of NEW rows.
 */
export async function insertJobs(
  db: Client,
  postings: JobPosting[]
): Promise<number> {
  if (postings.length === 0) return 0;

  // Dedupe within the batch — the same LinkedIn job can surface in multiple
  // search queries within one ingest run, producing duplicate ids.
  const seen = new Set<string>();
  postings = postings.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Look up which IDs already exist so we know what's new vs an update.
  const ids = postings.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const { rows: existingRows } = await db.execute({
    sql: `SELECT id FROM jobs WHERE id IN (${placeholders})`,
    args: ids,
  });
  const existing = new Set(existingRows.map((r) => r.id as string));

  let inserted = 0;
  for (const j of postings) {
    if (existing.has(j.id)) {
      // Re-encountered: bump last_seen_at and reopen if it was closed.
      await db.execute({
        sql: `UPDATE jobs SET last_seen_at = ?, status = 'open' WHERE id = ?`,
        args: [j.fetched_at, j.id],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO jobs (
          id, source, external_id, url, apply_url, ats_vendor,
          company_name, company_domain, company_hq_country,
          title, location_remote, location_raw, location_geo,
          visa_category, visa_target_countries_json, target_timezone,
          description_md, posted_at, raw_ref, fetched_at, last_seen_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        args: [
          j.id,
          j.source,
          j.external_id,
          j.url,
          j.apply_url ?? j.url, // fallback to the source URL if no separate apply page
          j.ats_vendor ?? null,
          j.company.name,
          j.company.domain ?? null,
          j.company.hq_country ?? null,
          j.title,
          j.location.remote ? 1 : 0,
          j.location.raw,
          j.location.geo ?? null,
          j.visa.category,
          JSON.stringify(j.visa.target_countries),
          j.target_timezone ?? null,
          j.description_md,
          j.posted_at,
          j.raw_ref ?? null,
          j.fetched_at,
          j.fetched_at,
        ],
      });
      inserted++;
    }
  }
  return inserted;
}

/**
 * After a successful adapter crawl, mark any of its jobs we didn't see this run as closed.
 * `crawlStartedAt` is the ISO timestamp from BEFORE the adapter ran — anything older means
 * we didn't re-encounter it this crawl.
 */
export async function closeMissing(
  db: Client,
  source: AdapterName,
  crawlStartedAt: string
): Promise<number> {
  const res = await db.execute({
    sql: `UPDATE jobs SET status = 'closed'
          WHERE source = ? AND status = 'open' AND last_seen_at < ?`,
    args: [source, crawlStartedAt],
  });
  return res.rowsAffected;
}
