// Seed the global-remote-focused adapters so the Ingest routine picks them
// up. WeWorkRemotely, Himalayas, Jobicy, WorkingNomads all publish exclusively
// remote jobs (mostly globally distributed). They were registered in code at
// src/core/adapters/registry.ts but never inserted into the DB, so the Ingest
// routine's `SELECT name FROM adapters WHERE enabled=1` returned only the
// original 3.
//
// Lever and Ashby are NOT seeded here — they need per-company tokens in
// config_json and require curation before they're useful.
//
// Idempotent — uses INSERT OR IGNORE then UPDATE to enable.

import "dotenv/config";
import { getDb } from "@/src/db/client";

const REMOTE_ADAPTERS = [
  "weworkremotely",
  "himalayas",
  "jobicy",
  "workingnomads",
];

async function main() {
  const db = getDb();
  for (const name of REMOTE_ADAPTERS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO adapters (name, enabled, config_json, consecutive_failures)
            VALUES (?, 1, '{}', 0)`,
      args: [name],
    });
    await db.execute({
      sql: `UPDATE adapters SET enabled = 1 WHERE name = ?`,
      args: [name],
    });
    console.log(`enabled: ${name}`);
  }
  const { rows } = await db.execute(
    "SELECT name, enabled, last_run_at FROM adapters ORDER BY name",
  );
  console.log("\nAll adapters:");
  console.table(rows.map((r) => ({ name: r.name, enabled: r.enabled, last_run_at: r.last_run_at })));
}
main().catch((e) => { console.error(e); process.exit(1); });
