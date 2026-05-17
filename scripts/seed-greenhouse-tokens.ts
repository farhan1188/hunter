import "dotenv/config";
import { getDb } from "@/src/db/client";

const TOKENS = [
  // Original 12
  "gitlab", "canonical", "mozilla", "stripe", "elastic",
  "figma", "vercel", "mongodb", "contentful", "remote",
  "n26", "airbnb",
  // YC + global-friendly additions (all verified live Greenhouse boards
  // as of 2026-05-17):
  "algolia", "cloudflare", "datadog", "sumup", "grafanalabs",
  "trustpilot", "circleci", "pinterest", "squarespace", "lyft",
  "instacart", "roblox",
];

async function main() {
  const db = getDb();
  const config = JSON.stringify({ tokens: TOKENS });
  await db.execute({
    sql: "UPDATE adapters SET config_json = ?, enabled = 1 WHERE name = 'greenhouse'",
    args: [config],
  });
  const { rows } = await db.execute({
    sql: "SELECT name, enabled, config_json FROM adapters WHERE name = 'greenhouse'",
  });
  console.log("greenhouse adapter row:", rows[0]);
}
main().catch((e) => { console.error(e); process.exit(1); });
