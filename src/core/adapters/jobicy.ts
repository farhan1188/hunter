import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

const ENDPOINT = "https://jobicy.com/api/v2/remote-jobs?count=100";

interface JobicyJob {
  id: string;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
}

export class JobicyAdapter implements Adapter {
  readonly name = "jobicy" as const;
  validateConfig(_: AdapterConfig): void {}

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(ENDPOINT, {
      headers: { "User-Agent": "job-hunter/1.0" },
    });
    if (!res.ok) throw new Error(`Jobicy fetch failed: ${res.status}`);
    const body = (await res.json()) as { jobs: JobicyJob[] };
    return this.parseJobs(body.jobs ?? []);
  }

  parseJobs(jobs: JobicyJob[]): JobPosting[] {
    return jobs.map((j) => ({
      id: makeJobId("jobicy", j.id),
      source: "jobicy" as const,
      external_id: j.id,
      url: j.url,
      company: { name: j.companyName },
      title: j.jobTitle,
      location: { remote: true, raw: j.jobGeo ?? "Remote" },
      visa: { category: "unknown" as const, target_countries: [] },
      description_md: j.jobExcerpt ?? stripHtml(j.jobDescription ?? ""),
      posted_at: j.pubDate ?? nowIso(),
      fetched_at: nowIso(),
    }));
  }
}
