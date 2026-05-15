import { createHash } from "node:crypto";
import { getDb } from "@/src/db/client";
import { insertJobs } from "@/src/core/jobs/persist";
import { classifyVisa } from "@/src/core/ingest/classify";
import { scoreJob } from "@/src/core/scoring/score";
import { saveScore } from "@/src/core/scoring/persist";
import { createQualified } from "@/src/core/applications/persist";
import { getProfile, getSettings } from "@/src/profile/store";
import { makeJobId, nowIso, stripHtml } from "@/src/core/adapters/util";
import type { JobPosting } from "@/src/core/types";

interface Extracted {
  title: string;
  company: string;
  description_md: string;
}

function parseAttr(html: string, prop: string): string | null {
  // OG / twitter meta tag parser — minimal regex; good enough for first-pass.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(re)?.[1] ?? null;
}

export function extractFromHtml(url: string, html: string): Extracted {
  const ogTitle = parseAttr(html, "og:title") ?? "";
  const ogDesc = parseAttr(html, "og:description") ?? "";

  // Title heuristic: split on " at " or " @ " or " - " or " | " etc.
  const titleParts = ogTitle.split(/\s+(?:at|@|-|\|)\s+/i);
  const titlePart = (titleParts[0] || "").trim();
  const companyPart = (titleParts[1] || "").trim() || new URL(url).hostname;

  return {
    title: titlePart || "Untitled role",
    company: companyPart,
    description_md: stripHtml(ogDesc),
  };
}

/** Server-side entry: fetch URL, extract, persist, qualify if scored above threshold. */
export async function importJobFromUrl(
  url: string
): Promise<{ jobId: string; applicationId: string | null; score: number | null }> {
  const res = await fetch(url, { headers: { "User-Agent": "job-hunter/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const { title, company, description_md } = extractFromHtml(url, html);

  const externalId = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const posting: JobPosting = {
    id: makeJobId("manual", externalId),
    source: "manual",
    external_id: externalId,
    url,
    apply_url: url,
    company: { name: company },
    title,
    location: { remote: false, raw: "" },
    visa: { category: "unknown", target_countries: [] },
    description_md,
    posted_at: nowIso(),
    fetched_at: nowIso(),
  };

  const db = getDb();
  await insertJobs(db, [posting]);

  // Visa: classify, then write back to the jobs row.
  let visaCategory: JobPosting["visa"]["category"] = "unknown";
  try {
    const classified = await classifyVisa(posting);
    visaCategory = classified.category;
    await db.execute({
      sql: `UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ?
            WHERE id = ?`,
      args: [
        classified.category,
        JSON.stringify(classified.target_countries),
        classified.target_timezone,
        posting.id,
      ],
    });
  } catch (err) {
    console.error(`classifyVisa failed for paste-URL:`, err);
  }

  // Score: scoreJob → saveScore.
  let scoreValue: number | null = null;
  try {
    const profile = await getProfile();
    const score = await scoreJob(profile, { ...posting, visa: { category: visaCategory, target_countries: [] } });
    score.job_id = posting.id;
    await saveScore(db, score);
    scoreValue = score.value;
  } catch (err) {
    console.error(`scoreJob failed for paste-URL:`, err);
  }

  // Qualify if above threshold.
  let applicationId: string | null = null;
  const settings = await getSettings();
  if (scoreValue !== null && scoreValue >= settings.score_threshold) {
    applicationId = await createQualified(db, posting.id, null, null);
  }

  return { jobId: posting.id, applicationId, score: scoreValue };
}
