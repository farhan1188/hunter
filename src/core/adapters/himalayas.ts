import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

const ENDPOINT = "https://himalayas.app/jobs/api?limit=100";

interface HimalayasJob {
  title: string;
  excerpt?: string;
  companyName: string;
  companySlug?: string;
  employmentType?: string;
  locationRestrictions?: string;
  description?: string;
  pubDate?: string;
  applicationLink: string;
  guid: string;
}

export class HimalayasAdapter implements Adapter {
  readonly name = "himalayas" as const;
  validateConfig(_: AdapterConfig): void {}

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(ENDPOINT, {
      headers: { "User-Agent": "job-hunter/1.0" },
    });
    if (!res.ok) throw new Error(`Himalayas fetch failed: ${res.status}`);
    const body = (await res.json()) as { jobs: HimalayasJob[] };
    return this.parseJobs(body.jobs ?? []);
  }

  parseJobs(jobs: HimalayasJob[]): JobPosting[] {
    return jobs.map((j) => {
      const externalId = j.guid;
      return {
        id: makeJobId("himalayas", externalId),
        source: "himalayas" as const,
        external_id: externalId,
        url: j.applicationLink,
        company: { name: j.companyName },
        title: j.title,
        location: { remote: true, raw: j.locationRestrictions ?? "Remote" },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: j.excerpt ?? stripHtml(j.description ?? ""),
        posted_at: j.pubDate
          ? new Date(Number(j.pubDate) * 1000).toISOString()
          : nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
