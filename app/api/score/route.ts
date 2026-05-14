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
 * Returns the count scored. UI calls in a loop until the response is 0.
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
  return NextResponse.json({ ok: true, scored, wiped: wipeFirst });
}
