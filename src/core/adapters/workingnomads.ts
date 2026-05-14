import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

const ENDPOINT = "https://www.workingnomads.com/api/exposed_jobs/?format=json";

interface WnJob {
  url: string;
  title: string;
  description?: string;
  pub_date?: string;
  company_name?: string;
  location?: string;
}

export class WorkingNomadsAdapter implements Adapter {
  readonly name = "workingnomads" as const;
  validateConfig(_: AdapterConfig): void {}

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(ENDPOINT, {
      headers: { "User-Agent": "job-hunter/1.0" },
    });
    if (!res.ok) throw new Error(`Working Nomads fetch failed: ${res.status}`);
    const jobs = (await res.json()) as WnJob[];
    return this.parseJobs(jobs);
  }

  parseJobs(jobs: WnJob[]): JobPosting[] {
    return jobs.map((j) => {
      // URL form: https://www.workingnomads.com/job/{category}/{id}/
      const idMatch = j.url.match(/\/job\/[^/]+\/(\d+)/);
      const externalId = idMatch?.[1] ?? j.url;
      return {
        id: makeJobId("workingnomads", externalId),
        source: "workingnomads" as const,
        external_id: externalId,
        url: j.url,
        company: { name: j.company_name ?? "Unknown" },
        title: j.title,
        location: { remote: true, raw: j.location ?? "Remote" },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: stripHtml(j.description ?? ""),
        posted_at: j.pub_date
          ? new Date(j.pub_date).toISOString()
          : nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
