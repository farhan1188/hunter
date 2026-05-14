import type { Client } from "@libsql/client";
import type { JobScore, JobPosting, Profile } from "@/src/core/types";
import { scoreJob } from "./score";

export async function saveScore(db: Client, score: JobScore): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO scores
          (job_id, value, reasoning, dimensions_json, scored_at, model)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      score.job_id,
      score.value,
      score.reasoning,
      JSON.stringify(score.dimensions),
      score.scored_at,
      score.model,
    ],
  });
}

/** Score every job that doesn't have a score yet. Returns count scored. */
export async function scoreUnscored(
  db: Client,
  profile: Profile
): Promise<number> {
  const { rows } = await db.execute(`
    SELECT j.id, j.source, j.external_id, j.url,
           j.company_name, j.title,
           j.location_remote, j.location_raw,
           j.visa_category, j.description_md, j.posted_at, j.fetched_at
    FROM jobs j
    LEFT JOIN scores s ON s.job_id = j.id
    WHERE s.job_id IS NULL AND j.archived = 0
    ORDER BY j.fetched_at DESC
    LIMIT 100
  `);

  let count = 0;
  for (const r of rows) {
    const posting: JobPosting = {
      id: r.id as string,
      source: r.source as JobPosting["source"],
      external_id: r.external_id as string,
      url: r.url as string,
      company: { name: r.company_name as string },
      title: r.title as string,
      location: {
        remote: Number(r.location_remote) === 1,
        raw: r.location_raw as string,
      },
      visa: {
        category: r.visa_category as JobPosting["visa"]["category"],
        target_countries: [],
      },
      description_md: r.description_md as string,
      posted_at: r.posted_at as string,
      fetched_at: r.fetched_at as string,
    };
    try {
      const score = await scoreJob(profile, posting);
      await saveScore(db, score);
      count++;
    } catch (err) {
      console.error(`Score failed for ${posting.id}:`, err);
    }
  }
  return count;
}
