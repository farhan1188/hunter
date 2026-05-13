import { NextRequest, NextResponse } from "next/server";
import { extractResume } from "@/src/profile/extract";
import { saveResume } from "@/src/profile/store";

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

  await saveResume({ pdfBase64: base64, filename: file.name, struct });
  return NextResponse.json({
    ok: true,
    experience_count: struct.experience.length,
    projects_count: struct.projects.length,
    primary_skills_count: struct.skills.primary.length,
  });
}
