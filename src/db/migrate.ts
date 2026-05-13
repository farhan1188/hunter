import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function main() {
  const db = getDb();

  // Bootstrap _migrations table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await db.execute("SELECT filename FROM _migrations");
  const applied = new Set(rows.map((r) => r.filename as string));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`SKIP  ${file} (already applied)`);
      continue;
    }
    console.log(`APPLY ${file}`);
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({
      sql: "INSERT INTO _migrations (filename) VALUES (?)",
      args: [file],
    });
  }

  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
