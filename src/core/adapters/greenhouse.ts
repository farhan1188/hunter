import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

interface GhConfig {
  tokens: string[];
}

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name: string };
  content?: string;
  offices?: Array<{ name: string }>;
}

function urlFor(token: string) {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
}

export class GreenhouseAdapter implements Adapter {
  readonly name = "greenhouse" as const;

  validateConfig(config: AdapterConfig): void {
    const c = config as Partial<GhConfig>;
    if (!Array.isArray(c.tokens) || c.tokens.length === 0) {
      throw new Error(
        "Greenhouse config requires { tokens: string[] } (board tokens)"
      );
    }
  }

  async fetch(config: AdapterConfig): Promise<JobPosting[]> {
    this.validateConfig(config);
    const c = config as unknown as GhConfig;
    const all: JobPosting[] = [];
    for (const token of c.tokens) {
      try {
        const res = await fetch(urlFor(token), {
          headers: { "User-Agent": "job-hunter/1.0" },
        });
        if (!res.ok) {
          console.warn(`Greenhouse fetch for "${token}" failed: ${res.status}`);
          continue;
        }
        const body = (await res.json()) as { jobs: GhJob[] };
        all.push(...this.parseJobs(token, body.jobs));
      } catch (err) {
        console.warn(`Greenhouse fetch error for "${token}":`, err);
      }
    }
    return all;
  }

  /** Exposed for tests; pure parsing. */
  parseJobs(token: string, jobs: GhJob[]): JobPosting[] {
    return jobs.map((j) => {
      const externalId = `${token}-${j.id}`;
      return {
        id: makeJobId("greenhouse", externalId),
        source: "greenhouse" as const,
        external_id: externalId,
        url: j.absolute_url,
        company: { name: token },
        title: j.title,
        location: {
          remote: /remote/i.test(j.location?.name ?? ""),
          raw: j.location?.name ?? "",
        },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: stripHtml(decodeURIComponent(j.content ?? "")),
        posted_at: j.updated_at,
        fetched_at: nowIso(),
      };
    });
  }
}
