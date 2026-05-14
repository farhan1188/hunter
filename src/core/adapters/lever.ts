import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

interface LeverConfig {
  /** Lever site identifiers (the `{site}` in jobs.lever.co/{site}). */
  sites: string[];
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  categories?: {
    department?: string;
    team?: string;
    location?: string;
    allLocations?: string[];
    commitment?: string;
  };
  country?: string;
  workplaceType?: "on-site" | "remote" | "hybrid" | string;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  lists?: Array<{ text: string; content: string }>;
}

function urlFor(site: string) {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
}

export class LeverAdapter implements Adapter {
  readonly name = "lever" as const;

  validateConfig(config: AdapterConfig): void {
    const c = config as Partial<LeverConfig>;
    if (!Array.isArray(c.sites) || c.sites.length === 0) {
      throw new Error("Lever config requires { sites: string[] }");
    }
  }

  async fetch(config: AdapterConfig): Promise<JobPosting[]> {
    this.validateConfig(config);
    const c = config as unknown as LeverConfig;
    const all: JobPosting[] = [];
    for (const site of c.sites) {
      try {
        const res = await fetch(urlFor(site), {
          headers: { "User-Agent": "job-hunter/1.0" },
        });
        if (!res.ok) {
          console.warn(`Lever fetch for "${site}" failed: ${res.status}`);
          continue;
        }
        const jobs = (await res.json()) as LeverJob[];
        all.push(...this.parseJobs(site, jobs));
      } catch (err) {
        console.warn(`Lever fetch error for "${site}":`, err);
      }
    }
    return all;
  }

  /** Exposed for tests. */
  parseJobs(site: string, jobs: LeverJob[]): JobPosting[] {
    return jobs.map((j) => {
      const externalId = `${site}-${j.id}`;
      const location = j.categories?.location ?? "";
      const isRemote =
        j.workplaceType === "remote" || /remote|worldwide/i.test(location);
      const fullDescription = [
        j.descriptionPlain ?? stripHtml(j.description ?? ""),
        j.additionalPlain ?? stripHtml(""),
        ...(j.lists?.map((l) => `${l.text}: ${stripHtml(l.content)}`) ?? []),
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        id: makeJobId("lever", externalId),
        source: "lever" as const,
        external_id: externalId,
        url: j.hostedUrl,
        company: {
          name: site,
          hq_country: j.country?.toLowerCase(),
        },
        title: j.text,
        location: { remote: isRemote, raw: location },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: fullDescription,
        posted_at: new Date(j.createdAt).toISOString(),
        fetched_at: nowIso(),
      };
    });
  }
}
