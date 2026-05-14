import { NextResponse } from "next/server";
import { getDb } from "@/src/db/client";
import { annotateUnclassified } from "@/src/core/ingest/annotate";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Classify visa + timezone for any jobs where visa_category = 'unknown'. */
export async function POST() {
  const annotated = await annotateUnclassified(getDb());
  return NextResponse.json({ ok: true, annotated });
}
