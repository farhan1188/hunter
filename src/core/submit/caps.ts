import type { Client } from "@libsql/client";

export async function submittedLast24h(db: Client, adapterName?: string): Promise<number> {
  const sql = adapterName
    ? `SELECT COUNT(*) AS n FROM applications a
         JOIN jobs j ON j.id = a.job_id
        WHERE a.submitted_at >= datetime('now','-1 day') AND
              (j.source = ? OR j.ats_vendor = ?)`
    : `SELECT COUNT(*) AS n FROM applications WHERE submitted_at >= datetime('now','-1 day')`;
  const { rows } = await db.execute({
    sql,
    args: adapterName ? [adapterName, adapterName] : [],
  });
  return (rows[0]?.n as number) ?? 0;
}

export async function submittedLast7d(db: Client): Promise<number> {
  const { rows } = await db.execute(`
    SELECT COUNT(*) AS n FROM applications WHERE submitted_at >= datetime('now','-7 day')
  `);
  return (rows[0]?.n as number) ?? 0;
}
