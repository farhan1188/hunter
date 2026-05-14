import Parser from "rss-parser";
import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

// All categories at /remote-jobs.rss; programming/engineering is the most relevant
const FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-product-jobs.rss",
];

export class WeWorkRemotelyAdapter implements Adapter {
  readonly name = "weworkremotely" as const;
  validateConfig(_: AdapterConfig): void {}

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const parser = new Parser();
    const all: JobPosting[] = [];
    for (const url of FEEDS) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "job-hunter/1.0" },
        });
        if (!res.ok) {
          console.warn(`WWR feed ${url} failed: ${res.status}`);
          continue;
        }
        const xml = await res.text();
        const feed = await parser.parseString(xml);
        all.push(...this.parseItems(feed.items));
      } catch (err) {
        console.warn(`WWR feed ${url} error:`, err);
      }
    }
    return all;
  }

  parseItems(items: Parser.Item[]): JobPosting[] {
    return items.map((item) => {
      const externalId = item.guid ?? item.link ?? Math.random().toString(36);
      // WWR title format: "Company Name: Job Title"
      const titleMatch = (item.title ?? "").match(/^([^:]+):\s*(.+)$/);
      const company = titleMatch?.[1]?.trim() ?? "Unknown";
      const title = titleMatch?.[2]?.trim() ?? item.title ?? "";
      return {
        id: makeJobId("weworkremotely", externalId),
        source: "weworkremotely" as const,
        external_id: externalId,
        url: item.link ?? "",
        company: { name: company },
        title,
        location: { remote: true, raw: "Worldwide" },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: stripHtml(item.contentSnippet ?? item.content ?? ""),
        posted_at: item.isoDate ?? nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
