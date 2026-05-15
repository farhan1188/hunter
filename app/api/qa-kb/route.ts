import { NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { listKb, upsertAnswer } from "@/src/core/qa/kb";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return NextResponse.json({ entries: await listKb(db) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const pattern = typeof body.pattern === "string" ? body.pattern.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  if (!pattern || !answer) return NextResponse.json({ error: "pattern + answer required" }, { status: 400 });
  const db = getDb();
  await upsertAnswer(db, pattern, answer);
  return NextResponse.json({ ok: true });
}
