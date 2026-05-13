import type { Client } from "@libsql/client";
import type { JobPosting } from "../types";

/**
 * Insert new job postings, skipping ones already present (unique on source+external_id).
 * Returns the count actually inserted.
 */
export async function insertJobs(
  db: Client,
  postings: JobPosting[]
): Promise<number> {
  if (postings.length === 0) return 0;

  let inserted = 0;
  for (const j of postings) {
    const res = await db.execute({
      sql: `INSERT OR IGNORE INTO jobs (
        id, source, external_id, url, company_name, company_domain, company_hq_country,
        title, location_remote, location_raw, location_geo,
        visa_category, visa_target_countries_json, target_timezone,
        description_md, posted_at, raw_ref, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        j.id,
        j.source,
        j.external_id,
        j.url,
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
      ],
    });
    if (res.rowsAffected > 0) inserted++;
  }
  return inserted;
}
