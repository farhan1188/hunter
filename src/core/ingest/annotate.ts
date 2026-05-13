import type { Client } from "@libsql/client";
import { classifyVisa } from "./classify";

/** Classify visa + timezone for all jobs where visa_category = 'unknown'. */
export async function annotateUnclassified(
  db: Client,
  limit = 100
): Promise<number> {
  const { rows } = await db.execute({
    sql: `SELECT id, title, company_name, location_raw, description_md
          FROM jobs WHERE visa_category = 'unknown' AND archived = 0
          ORDER BY fetched_at DESC LIMIT ?`,
    args: [limit],
  });

  let n = 0;
  for (const r of rows) {
    try {
      const result = await classifyVisa({
        title: r.title as string,
        company: { name: r.company_name as string },
        location: { remote: false, raw: (r.location_raw as string) ?? "" },
        description_md: r.description_md as string,
      });
      await db.execute({
        sql: `UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ?
              WHERE id = ?`,
        args: [
          result.category,
          JSON.stringify(result.target_countries),
          result.target_timezone,
          r.id as string,
        ],
      });
      n++;
    } catch (err) {
      console.error(`Classify failed for ${r.id}:`, err);
    }
  }
  return n;
}
