import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/src/db/client";

export const runtime = "nodejs";

const TMP_DIR = path.resolve("./tmp");

// Serve the rendered resume PDF for an application from the local ./tmp/ dir.
// (Cloud routines upload to Drive instead; this route covers the local-test path.)
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { rows } = await getDb().execute({
    sql: "SELECT resume_pdf_path FROM applications WHERE id = ?",
    args: [id],
  });
  const filename = rows[0]?.resume_pdf_path as string | null | undefined;
  if (!filename) {
    return NextResponse.json({ error: "no resume" }, { status: 404 });
  }
  // Disallow any path traversal — only the bare filename is accepted.
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "bad filename" }, { status: 400 });
  }
  const fullPath = path.join(TMP_DIR, filename);
  try {
    const buf = await readFile(fullPath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found on disk" }, { status: 404 });
  }
}
