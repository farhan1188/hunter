import { NextRequest, NextResponse } from "next/server";
import { extractResume } from "@/src/profile/extract";
import { saveResume } from "@/src/profile/store";
import { uploadToDrive } from "@/src/lib/drive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF only" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");

  // 1. Drive first (if configured) — gives us a stable file ID before any DB write
  let driveFileId: string | null = null;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    try {
      driveFileId = await uploadToDrive({
        name: `profile/resume-${Date.now()}-${file.name}`,
        mimeType: "application/pdf",
        body: Buffer.from(bytes),
      });
    } catch (err) {
      console.warn("Drive upload failed; continuing with Turso-only:", err);
    }
  }

  // 2. Extract via Sonnet
  let struct;
  try {
    struct = await extractResume(bytes);
  } catch (err) {
    return NextResponse.json(
      {
        error: `extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }

  // 3. Save to Turso
  await saveResume({
    pdfBase64: base64,
    filename: file.name,
    struct,
    driveFileId,
  });

  return NextResponse.json({
    ok: true,
    drive_file_id: driveFileId,
    experience_count: struct.experience.length,
    projects_count: struct.projects.length,
    primary_skills_count: struct.skills.primary.length,
  });
}
