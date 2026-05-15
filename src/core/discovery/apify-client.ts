// src/core/discovery/apify-client.ts

export interface RunActorOptions {
  actorId: string;
  token: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Call Apify's run-sync-get-dataset-items endpoint. Returns the items array.
 * Apify keeps the connection open while the actor runs (up to ~5 min default),
 * then streams the dataset back as a single JSON response.
 */
export async function runActorSync<T = unknown>(opts: RunActorOptions): Promise<T[]> {
  const url =
    `https://api.apify.com/v2/acts/${encodeURIComponent(opts.actorId)}` +
    `/run-sync-get-dataset-items?token=${encodeURIComponent(opts.token)}&clean=true&format=json`;
  const controller = new AbortController();
  const timer = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts.input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Apify run failed: HTTP ${res.status} ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as T[];
    if (!Array.isArray(data)) throw new Error("Apify response was not an array");
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
