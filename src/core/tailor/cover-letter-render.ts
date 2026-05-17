import { spawn } from "node:child_process";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Render a markdown cover letter to PDF using the Typst CLI.
 * Returns a Buffer of the PDF bytes.
 *
 * The output is intentionally plain: candidate header (name/email/phone/location),
 * a date line, salutation/body/signature. Many ATS systems require a PDF cover-
 * letter file upload — we generate one from the markdown stored in
 * applications.cover_letter_md.
 */
export interface CoverLetterRenderInput {
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  candidate_location?: string;
  letter_markdown: string;
  company_name?: string;
  role_title?: string;
}

function escapeTypst(s: string): string {
  // Typst uses backslash, hash, and asterisk as control characters. The body
  // is wrapped in `[` so most of it is literal; we only need to escape the
  // characters Typst treats specially inside `[...]`.
  return s
    .replace(/\\/g, "\\\\")
    .replace(/#/g, "\\#")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/@/g, "\\@");
}

function paragraphs(markdown: string): string[] {
  return markdown
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function renderCoverLetterPdf(input: CoverLetterRenderInput): Promise<Buffer> {
  const paras = paragraphs(input.letter_markdown);
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const header = [
    `*${escapeTypst(input.candidate_name)}*`,
    [input.candidate_email, input.candidate_phone, input.candidate_location]
      .filter(Boolean)
      .map((s) => escapeTypst(s!))
      .join(" • "),
  ].join("\\\n");

  const body = paras.map((p) => `${escapeTypst(p)}\n`).join("\n");

  const main = `
#set page(
  paper: "us-letter",
  margin: (x: 0.9in, y: 0.85in),
)
#set text(font: "New Computer Modern", size: 11pt)
#set par(justify: false, leading: 0.65em, first-line-indent: 0pt)

${header}

#v(0.6em)
${escapeTypst(today)}

#v(0.4em)
${body}
`;

  const dir = await mkdtemp(path.join(tmpdir(), "job-hunter-cover-"));
  try {
    const mainPath = path.join(dir, "main.typ");
    const outPath = path.join(dir, "out.pdf");
    await writeFile(mainPath, main, "utf8");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(process.env.TYPST_BIN || "typst", ["compile", mainPath, outPath]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += String(chunk); });
      proc.on("error", reject);
      proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`typst exit ${code}: ${stderr}`)));
    });

    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
