import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { getProfile } from "@/src/profile/store";
import { scoreUnscored } from "@/src/core/scoring/persist";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Score all unscored jobs against the current profile.
 * Pass `?all=true` to wipe existing scores first (re-score everything).
 * Processes up to 100 per request to stay within Next.js route timeouts.
 * Returns the count scored + count still remaining so the UI can show progress.
 */
export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile.resume_struct) {
    return NextResponse.json(
      { error: "No resume uploaded yet — upload one on the Profile page first." },
      { status: 400 }
    );
  }

  const url = new URL(req.url);
  const wipeFirst = url.searchParams.get("all") === "true";

  const db = getDb();
  if (wipeFirst) {
    await db.execute("DELETE FROM scores");
  }
  const scored = await scoreUnscored(db, profile);

  // Remaining unscored (excluding archetype mismatches — we don't score those).
  const { rows: remainRows } = await db.execute(`
    SELECT count(*) AS n FROM jobs j
    LEFT JOIN scores s ON s.job_id = j.id
    WHERE s.job_id IS NULL AND j.archived = 0
      AND j.archetype_match IN ('match', 'maybe', 'unknown')
  `);
  const remaining = Number(remainRows[0]?.n ?? 0);

  return NextResponse.json({ ok: true, scored, remaining, wiped: wipeFirst });
}
