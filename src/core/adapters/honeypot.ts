import Parser from "rss-parser";
import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

const FEED_URL = "https://www.honeypot.io/rss";

export class HoneypotAdapter implements Adapter {
  readonly name = "honeypot" as const;

  validateConfig(_: AdapterConfig): void {
    // zero-config
  }

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "job-hunter/1.0" },
    });
    if (!res.ok) throw new Error(`Honeypot RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    return this.parseFeed(xml);
  }

  /** Exposed for tests so we can avoid mocking the network. */
  async parseFeed(xml: string): Promise<JobPosting[]> {
    const feed = await new Parser().parseString(xml);
    return feed.items.map((item) => {
      const externalId =
        item.guid ?? item.link ?? Math.random().toString(36).slice(2);
      const rawTitle = item.title ?? "";
      const titleMatch = rawTitle.match(/^(.*?)\s+at\s+(.*?)$/i);
      const title = titleMatch?.[1] ?? rawTitle;
      const company = titleMatch?.[2] ?? "Unknown";
      return {
        id: makeJobId("honeypot", externalId),
        source: "honeypot" as const,
        external_id: externalId,
        url: item.link ?? "",
        company: { name: company, hq_country: "de" },
        title,
        location: { remote: true, raw: "Germany / Remote" },
        visa: { category: "unknown" as const, target_countries: [] },
        description_md: stripHtml(item.contentSnippet ?? item.content ?? ""),
        posted_at: item.isoDate ?? nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
