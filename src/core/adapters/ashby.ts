import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

interface AshbyConfig {
  /** Ashby org names — the `{org}` in jobs.ashbyhq.com/{org}. */
  orgs: string[];
}

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: Array<{ location: string }>;
  descriptionPlain?: string;
  descriptionHtml?: string;
  jobUrl: string;
  isRemote?: boolean;
  publishedAt?: string;
}

function urlFor(org: string) {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`;
}

export class AshbyAdapter implements Adapter {
  readonly name = "ashby" as const;

  validateConfig(config: AdapterConfig): void {
    const c = config as Partial<AshbyConfig>;
    if (!Array.isArray(c.orgs) || c.orgs.length === 0) {
      throw new Error("Ashby config requires { orgs: string[] }");
    }
  }

  async fetch(config: AdapterConfig): Promise<JobPosting[]> {
    this.validateConfig(config);
    const c = config as unknown as AshbyConfig;
    const all: JobPosting[] = [];
    for (const org of c.orgs) {
      try {
        const res = await fetch(urlFor(org), {
          headers: { "User-Agent": "job-hunter/1.0" },
        });
        if (!res.ok) {
          console.warn(`Ashby fetch for "${org}" failed: ${res.status}`);
          continue;
        }
        const body = (await res.json()) as { jobs: AshbyJob[] };
        all.push(...this.parseJobs(org, body.jobs ?? []));
      } catch (err) {
        console.warn(`Ashby fetch error for "${org}":`, err);
      }
    }
    return all;
  }

  parseJobs(org: string, jobs: AshbyJob[]): JobPosting[] {
    return jobs.map((j) => {
      const externalId = `${org}-${j.id}`;
      const isRemote =
        Boolean(j.isRemote) ||
        /remote|worldwide|anywhere/i.test(j.location ?? "");
      return {
        id: makeJobId("ashby", externalId),
        source: "ashby" as const,
        external_id: externalId,
        url: j.jobUrl,
        company: { name: org },
        title: j.title,
        location: { remote: isRemote, raw: j.location ?? "" },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md:
          j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ""),
        posted_at: j.publishedAt ?? nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
