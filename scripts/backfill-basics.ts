// One-shot: seed profile.basics with name + email so cover letters stop signing
// "[Candidate Name]". Edit values below and re-run if needed.
import "dotenv/config";
import { getDb } from "@/src/db/client";

const NAME = "Farhan";
const EMAIL = "farhan1188@gmail.com";

async function main() {
  const db = getDb();
  const { rows } = await db.execute("SELECT basics_json FROM profile WHERE id = 1");
  const existing = JSON.parse((rows[0]?.basics_json as string) ?? "{}");
  const merged = { ...existing, name: NAME, email: EMAIL };
  await db.execute({
    sql: "UPDATE profile SET basics_json = ? WHERE id = 1",
    args: [JSON.stringify(merged)],
  });
  console.log("basics now:", merged);
}
main().catch((e) => { console.error(e); process.exit(1); });
