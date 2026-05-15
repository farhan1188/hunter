import { NextResponse } from "next/server";
import { importJobFromUrl } from "@/src/core/discovery/import-url";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "url required (http/https)" }, { status: 400 });
  }
  try {
    const result = await importJobFromUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
