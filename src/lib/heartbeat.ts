import { getDb } from "@/src/db/client";

interface Expected {
  routine: string;
  intervalMinutes: number;
}

const EXPECTED: Expected[] = [
  { routine: "ingest", intervalMinutes: 120 },
  { routine: "backup", intervalMinutes: 24 * 60 },
  { routine: "reconciler", intervalMinutes: 24 * 60 },
  { routine: "notify-digest", intervalMinutes: 24 * 60 },
];

/** Returns list of routines whose last successful run is older than 2× expected interval. */
export async function staleRoutines(): Promise<string[]> {
  const db = getDb();
  const stale: string[] = [];
  for (const e of EXPECTED) {
    const { rows } = await db.execute({
      sql: `SELECT max(started_at) AS last FROM routine_runs WHERE routine = ? AND ok = 1`,
      args: [e.routine],
    });
    const last = rows[0]?.last as string | null;
    if (!last) {
      stale.push(e.routine);
      continue;
    }
    const ageMin = (Date.now() - new Date(last).getTime()) / 60_000;
    if (ageMin > e.intervalMinutes * 2) stale.push(e.routine);
  }
  return stale;
}
