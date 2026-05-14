import { NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { getProfile } from "@/src/profile/store";
import { scoreUnscored } from "@/src/core/scoring/persist";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

/**
 * Score all unscored jobs against the current profile.
 * Processes up to 100 per request to stay within Next.js route timeouts.
 * Returns the count scored. UI calls in a loop until the response is 0.
 */
export async function POST() {
  const profile = await getProfile();
  if (!profile.resume_struct) {
    return NextResponse.json(
      { error: "No resume uploaded yet — upload one on the Profile page first." },
      { status: 400 }
    );
  }
  const scored = await scoreUnscored(getDb(), profile);
  return NextResponse.json({ ok: true, scored });
}
