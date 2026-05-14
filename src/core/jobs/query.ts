import { getDb } from "@/src/db/client";
import type { JobPosting, VisaCategory, AdapterName } from "@/src/core/types";

export interface FeedRow extends JobPosting {
  score: number | null;
  score_reasoning: string | null;
  status: "open" | "closed";
  last_seen_at: string;
}

export interface FeedFilters {
  source?: AdapterName;
  visa_category?: VisaCategory;
  country?: string;
  min_score?: number;
  include_closed?: boolean;
  limit?: number;
}

export async function listFeed(filters: FeedFilters = {}): Promise<FeedRow[]> {
  const db = getDb();
  const wheres = ["j.archived = 0"];
  const args: (string | number)[] = [];

  if (!filters.include_closed) {
    wheres.push("j.status = 'open'");
  }
  // Hide archetype mismatches by default (they're wrong-career-family jobs).
  // include_closed also reveals these for transparency.
  if (!filters.include_closed) {
    wheres.push("j.archetype_match IN ('match', 'maybe', 'unknown')");
  }
  if (filters.source) {
    wheres.push("j.source = ?");
    args.push(filters.source);
  }
  if (filters.visa_category) {
    wheres.push("j.visa_category = ?");
    args.push(filters.visa_category);
  }
  if (filters.country) {
    wheres.push("instr(lower(j.visa_target_countries_json), ?) > 0");
    args.push(`"${filters.country.toLowerCase()}"`);
  }
  if (typeof filters.min_score === "number") {
    wheres.push("s.value >= ?");
    args.push(filters.min_score);
  }

  args.push(filters.limit ?? 200);

  const { rows } = await db.execute({
    sql: `
      SELECT j.id, j.source, j.external_id, j.url,
             j.company_name, j.company_domain, j.company_hq_country,
             j.title, j.location_remote, j.location_raw, j.location_geo,
             j.visa_category, j.visa_target_countries_json, j.target_timezone,
             j.description_md, j.posted_at, j.raw_ref, j.fetched_at,
             j.last_seen_at, j.status,
             s.value AS score, s.reasoning AS score_reasoning
      FROM jobs j LEFT JOIN scores s ON s.job_id = j.id
      WHERE ${wheres.join(" AND ")}
      ORDER BY (s.value IS NULL), s.value DESC, j.fetched_at DESC
      LIMIT ?
    `,
    args,
  });

  return rows.map((r) => ({
    id: r.id as string,
    source: r.source as JobPosting["source"],
    external_id: r.external_id as string,
    url: r.url as string,
    company: {
      name: r.company_name as string,
      domain: (r.company_domain as string | null) ?? undefined,
      hq_country: (r.company_hq_country as string | null) ?? undefined,
    },
    title: r.title as string,
    location: {
      remote: Number(r.location_remote) === 1,
      raw: r.location_raw as string,
      geo: (r.location_geo as string | null) ?? undefined,
    },
    visa: {
      category: r.visa_category as VisaCategory,
      target_countries: JSON.parse(
        (r.visa_target_countries_json as string) || "[]"
      ),
    },
    target_timezone: (r.target_timezone as string | null) ?? undefined,
    description_md: r.description_md as string,
    posted_at: r.posted_at as string,
    raw_ref: (r.raw_ref as string | null) ?? undefined,
    fetched_at: r.fetched_at as string,
    score: r.score === null ? null : Number(r.score),
    score_reasoning: (r.score_reasoning as string | null) ?? null,
    status: (r.status as "open" | "closed") ?? "open",
    last_seen_at: (r.last_seen_at as string) ?? (r.fetched_at as string),
  }));
}
