import type { Adapter, AdapterConfig } from "./types";
import type { JobPosting } from "../types";
import { makeJobId, nowIso, stripHtml } from "./util";

const ENDPOINT = "https://remoteok.com/api";

interface RemoteOKItem {
  id: string;
  url: string;
  position: string;
  company: string;
  location?: string;
  description?: string;
  date: string;
}

function isJobItem(x: unknown): x is RemoteOKItem {
  return (
    typeof x === "object" &&
    x !== null &&
    "id" in x &&
    "position" in x &&
    "company" in x &&
    "url" in x &&
    "date" in x
  );
}

export class RemoteOKAdapter implements Adapter {
  readonly name = "remoteok" as const;

  validateConfig(_: AdapterConfig): void {
    // RemoteOK is zero-config.
  }

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(ENDPOINT, {
      headers: { "User-Agent": "job-hunter/1.0 (personal use)" },
    });
    if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
    const raw = (await res.json()) as unknown[];

    const postings: JobPosting[] = [];
    for (const item of raw) {
      if (!isJobItem(item)) continue;
      postings.push({
        id: makeJobId("remoteok", String(item.id)),
        source: "remoteok",
        external_id: String(item.id),
        url: item.url,
        company: { name: item.company },
        title: item.position,
        location: { remote: true, raw: item.location ?? "Remote" },
        visa: { category: "unknown", target_countries: [] },
        description_md: stripHtml(item.description ?? ""),
        posted_at: item.date,
        fetched_at: nowIso(),
      });
    }
    return postings;
  }
}
