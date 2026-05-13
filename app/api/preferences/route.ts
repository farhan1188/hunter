import { NextRequest, NextResponse } from "next/server";
import { PreferencesSchema } from "@/src/core/schemas";
import { savePreferences } from "@/src/profile/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await savePreferences(parsed.data);
  return NextResponse.json({ ok: true });
}
