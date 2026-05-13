import { createHash } from "node:crypto";
import type { AdapterName } from "../types";

/** Stable hash for (source, external_id). 16 hex chars handles a few hundred thousand jobs. */
export function makeJobId(source: AdapterName, externalId: string): string {
  return createHash("sha256")
    .update(`${source}::${externalId}`)
    .digest("hex")
    .slice(0, 16);
}

/** ISO timestamp now. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Strip HTML tags, collapse whitespace. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
