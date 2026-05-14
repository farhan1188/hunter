import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { getAdapter } from "@/src/core/adapters/registry";
import { insertJobs } from "@/src/core/jobs/persist";
import type { AdapterName } from "@/src/core/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Crawl all enabled adapters (or a single named adapter if `?name=X`).
 * Returns per-adapter inserted counts.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const singleName = url.searchParams.get("name") as AdapterName | null;

  const db = getDb();
  const { rows } = await db.execute(
    "SELECT name, config_json FROM adapters WHERE enabled = 1"
  );
  const toRun = singleName
    ? rows.filter((r) => r.name === singleName)
    : rows;

  const results: Array<{ name: string; fetched: number; inserted: number; error?: string }> = [];
  for (const r of toRun) {
    const name = r.name as AdapterName;
    const adapter = getAdapter(name);
    if (!adapter) {
      results.push({ name, fetched: 0, inserted: 0, error: "not registered" });
      continue;
    }
    try {
      const config = JSON.parse((r.config_json as string) || "{}");
      const postings = await adapter.fetch(config);
      const inserted = await insertJobs(db, postings);
      await db.execute({
        sql: "UPDATE adapters SET last_run_at = datetime('now'), last_success_at = datetime('now'), last_error = NULL, consecutive_failures = 0 WHERE name = ?",
        args: [name],
      });
      results.push({ name, fetched: postings.length, inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.execute({
        sql: "UPDATE adapters SET last_run_at = datetime('now'), last_error = ?, consecutive_failures = consecutive_failures + 1 WHERE name = ?",
        args: [msg, name],
      });
      results.push({ name, fetched: 0, inserted: 0, error: msg });
    }
  }
  return NextResponse.json({ ok: true, results });
}
