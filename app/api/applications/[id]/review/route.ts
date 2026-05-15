import { NextResponse } from "next/server";
import { transition } from "@/src/core/applications/persist";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const db = getDb();
  try {
    if (action === "accept") {
      await transition(db, id, "ready");
      return NextResponse.json({ ok: true, state: "ready" });
    }
    if (action === "dismiss") {
      await transition(db, id, "dismissed");
      return NextResponse.json({ ok: true, state: "dismissed" });
    }
    if (action === "mark_submitted") {
      await transition(db, id, "submitted", { submitted_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, state: "submitted" });
    }
    return NextResponse.json({ error: "action must be accept|dismiss|mark_submitted" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
