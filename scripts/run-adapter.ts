import "dotenv/config";
import { getDb } from "@/src/db/client";
import { getAdapter } from "@/src/core/adapters/registry";
import { insertJobs } from "@/src/core/jobs/persist";
import type { AdapterName } from "@/src/core/types";

async function main() {
  const name = process.argv[2] as AdapterName | undefined;
  if (!name) {
    console.error("Usage: npx tsx scripts/run-adapter.ts <adapter-name>");
    process.exit(1);
  }
  const adapter = getAdapter(name);
  if (!adapter) {
    console.error(`Adapter not registered: ${name}`);
    process.exit(1);
  }

  const db = getDb();
  const { rows } = await db.execute({
    sql: "SELECT config_json FROM adapters WHERE name = ?",
    args: [name],
  });
  const config = rows[0]
    ? JSON.parse((rows[0].config_json as string) || "{}")
    : {};

  console.log(`Fetching from ${name} with config:`, config);
  const postings = await adapter.fetch(config);
  console.log(`Got ${postings.length} postings.`);

  const inserted = await insertJobs(db, postings);
  console.log(
    `Inserted ${inserted} new rows (${postings.length - inserted} duplicates skipped).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
