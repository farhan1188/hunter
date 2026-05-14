import { NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { getProfile } from "@/src/profile/store";
import {
  classifyArchetypes,
  type ArchetypeLabel,
} from "@/src/core/ingest/archetype";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Classify archetype for jobs where archetype_match = 'unknown' (legacy rows).
 * Processes up to 200 per request. UI calls in a loop until response shows 0.
 */
export async function POST() {
  const profile = await getProfile();
  if (!profile.preferences.target_roles?.length) {
    return NextResponse.json(
      { error: "Set target_roles in /profile preferences first." },
      { status: 400 }
    );
  }
  const db = getDb();
  const { rows } = await db.execute(
    `SELECT id, title FROM jobs
     WHERE archetype_match = 'unknown' AND archived = 0
     ORDER BY fetched_at DESC LIMIT 200`
  );
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, classified: 0, remaining: 0 });
  }
  const labels = await classifyArchetypes(
    profile,
    rows.map((r) => ({ id: r.id as string, title: r.title as string }))
  );

  let classified = 0;
  for (const [id, label] of labels) {
    await db.execute({
      sql: "UPDATE jobs SET archetype_match = ? WHERE id = ?",
      args: [label as ArchetypeLabel, id],
    });
    classified++;
  }

  const { rows: remainRows } = await db.execute(
    "SELECT count(*) AS n FROM jobs WHERE archetype_match = 'unknown' AND archived = 0"
  );
  const remaining = Number(remainRows[0]?.n ?? 0);
  return NextResponse.json({ ok: true, classified, remaining });
}
