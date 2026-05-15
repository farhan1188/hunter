import { NextResponse } from "next/server";
import { draftOutreach } from "@/src/core/outreach/draft";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  try {
    const draft = await draftOutreach(db, id);
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
