import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { getAdapter } from "@/src/core/adapters/registry";
import { insertJobs, closeMissing } from "@/src/core/jobs/persist";
import { getProfile } from "@/src/profile/store";
import { classifyArchetypes, toMinimal } from "@/src/core/ingest/archetype";
import type { AdapterName } from "@/src/core/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Crawl all enabled adapters (or a single named adapter if `?name=X`).
 * After each adapter's crawl succeeds, mark any of its jobs we didn't see this
 * run as `closed` (the source dropped them).
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

  // Load profile once for archetype classification
  let profile: Awaited<ReturnType<typeof getProfile>> | null = null;
  try {
    profile = await getProfile();
  } catch {
    profile = null;
  }
  const canClassify = !!profile?.preferences.target_roles?.length;

  const results: Array<{
    name: string;
    fetched: number;
    inserted: number;
    classified: number;
    mismatched: number;
    closed: number;
    error?: string;
  }> = [];

  for (const r of toRun) {
    const name = r.name as AdapterName;
    const adapter = getAdapter(name);
    if (!adapter) {
      results.push({
        name,
        fetched: 0,
        inserted: 0,
        classified: 0,
        mismatched: 0,
        closed: 0,
        error: "not registered",
      });
      continue;
    }
    // Capture the moment BEFORE we crawl — anything with last_seen_at older than this
    // after we finish the crawl was not in this run's results.
    const crawlStartedAt = new Date().toISOString();
    try {
      const config = JSON.parse((r.config_json as string) || "{}");
      const postings = await adapter.fetch(config);

      // Insert (may include dupes which become updates)
      const inserted = await insertJobs(db, postings);

      // Classify archetype on newly-inserted rows only.
      // We re-query to find which ones are still 'unknown' from this batch (i.e. truly new).
      let classified = 0;
      let mismatched = 0;
      if (canClassify && profile && postings.length > 0) {
        const newIds = postings.map((p) => p.id);
        const placeholders = newIds.map(() => "?").join(",");
        const { rows: unknownRows } = await db.execute({
          sql: `SELECT id, title FROM jobs
                WHERE archetype_match = 'unknown' AND id IN (${placeholders})`,
          args: newIds,
        });
        if (unknownRows.length > 0) {
          const labels = await classifyArchetypes(
            profile,
            unknownRows.map((u) => ({
              id: u.id as string,
              title: u.title as string,
            }))
          );
          for (const [id, label] of labels) {
            await db.execute({
              sql: "UPDATE jobs SET archetype_match = ? WHERE id = ?",
              args: [label, id],
            });
            classified++;
            if (label === "mismatch") mismatched++;
          }
        }
      }

      const closed =
        postings.length > 0
          ? await closeMissing(db, name, crawlStartedAt)
          : 0;
      await db.execute({
        sql: `UPDATE adapters SET last_run_at = datetime('now'),
                last_success_at = datetime('now'),
                last_error = NULL, consecutive_failures = 0
              WHERE name = ?`,
        args: [name],
      });
      results.push({
        name,
        fetched: postings.length,
        inserted,
        classified,
        mismatched,
        closed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.execute({
        sql: `UPDATE adapters SET last_run_at = datetime('now'),
                last_error = ?, consecutive_failures = consecutive_failures + 1
              WHERE name = ?`,
        args: [msg, name],
      });
      results.push({
        name,
        fetched: 0,
        inserted: 0,
        classified: 0,
        mismatched: 0,
        closed: 0,
        error: msg,
      });
    }
  }
  return NextResponse.json({ ok: true, results });
}
