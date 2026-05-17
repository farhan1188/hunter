// One-shot: import resume from a .docx file. Uses mammoth to extract plain text,
// then Sonnet to extract structured fields. Replaces the current profile.resume_struct.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import { extractResumeFromText } from "@/src/profile/extract";
import { saveResume } from "@/src/profile/store";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("usage: tsx scripts/import-resume-docx.ts <path-to-docx>");
    process.exit(1);
  }

  console.log(`Reading ${filePath}...`);
  const buffer = await readFile(filePath);
  const { value: text, messages } = await mammoth.extractRawText({ buffer });
  if (messages.length > 0) {
    console.log("mammoth warnings:", messages);
  }
  console.log(`Extracted ${text.length} chars of text.`);

  console.log("Sending to Sonnet for structured extraction...");
  const struct = await extractResumeFromText(text);
  console.log(
    `Structured: experience=${struct.experience.length}, projects=${struct.projects.length}, skills.primary=${struct.skills.primary.length}, education=${struct.education.length}`,
  );

  await saveResume({
    pdfBase64: "",
    filename: filePath.split(/[\\/]/).pop() ?? "resume.docx",
    struct,
    driveFileId: null,
  });
  console.log("Saved to profile.");
}

main().catch((e) => { console.error(e); process.exit(1); });
