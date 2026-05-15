import { NextResponse } from "next/server";
import { transition } from "@/src/core/applications/persist";
import { getDb } from "@/src/db/client";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  await transition(db, id, "ready");
  return NextResponse.json({ ok: true });
}
