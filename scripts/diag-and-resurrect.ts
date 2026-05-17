import "dotenv/config";
import { getDb } from "@/src/db/client";

async function main() {
  const db = getDb();
  console.log("BEFORE:");
  const r1 = await db.execute(
    "SELECT visa_category, archived, COUNT(*) AS n FROM jobs GROUP BY visa_category, archived ORDER BY visa_category, archived",
  );
  console.table(r1.rows.map((r) => ({ visa_category: r.visa_category, archived: r.archived, n: Number(r.n) })));

  const r2 = await db.execute(
    "UPDATE jobs SET archived = 0, status = 'open' WHERE archived = 1 AND visa_category = 'unknown'",
  );
  console.log("Resurrected unknowns:", r2.rowsAffected);

  console.log("AFTER:");
  const r3 = await db.execute(
    "SELECT visa_category, archived, COUNT(*) AS n FROM jobs GROUP BY visa_category, archived ORDER BY visa_category, archived",
  );
  console.table(r3.rows.map((r) => ({ visa_category: r.visa_category, archived: r.archived, n: Number(r.n) })));
}
main().catch((e) => { console.error(e); process.exit(1); });
