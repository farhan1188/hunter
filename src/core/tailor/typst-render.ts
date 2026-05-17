import { spawn } from "node:child_process";
import { writeFile, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ResumeStruct, ProfileBasics } from "@/src/core/types";
import type { RankedBullet } from "./bullet-selection";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ResumeRenderInput {
  basics: ProfileBasics;
  selected_bullets: RankedBullet[];
  resume: ResumeStruct;
}

/**
 * Render the resume to PDF using the Typst CLI. Returns a Buffer of the PDF bytes.
 * Requires `typst` on PATH or TYPST_BIN env var pointing at the binary.
 *
 * Renders the COMPLETE resume — every experience, every project, the summary —
 * not just the JD-matched bullets. Tailoring re-orders bullets within each role
 * so the most JD-relevant ones appear first, but no role or project gets dropped
 * (chronological story matters; current roles with sparse bullets must still show).
 */
export async function renderResumePdf(input: ResumeRenderInput): Promise<Buffer> {
  // Index the selected bullets by their text so we can prioritize them within
  // each experience without losing the others.
  const selectedTexts = new Set(input.selected_bullets.map((b) => b.text));

  const experiences = input.resume.experience.map((e) => {
    // Stable partition: JD-matched bullets first, others after, original order within each.
    const matched = e.bullets.filter((b) => selectedTexts.has(b.text));
    const rest = e.bullets.filter((b) => !selectedTexts.has(b.text));
    return {
      company: e.company,
      title: e.title,
      start: e.start,
      end: e.end ?? "present",
      bullets: [...matched, ...rest].map((b) => b.text),
    };
  });

  const projects = input.resume.projects.map((p) => ({
    name: p.name,
    bullets: p.bullets.map((b) => b.text),
  }));

  const inputJson = {
    name: input.basics.name ?? "",
    email: input.basics.email ?? "",
    phone: input.basics.phone ?? "",
    location: input.basics.location ?? "",
    links: input.basics.links ?? [],
    summary: input.resume.summary ?? "",
    experiences,
    projects,
    skills: input.resume.skills,
    education: input.resume.education,
  };

  const dir = await mkdtemp(path.join(tmpdir(), "job-hunter-typst-"));
  try {
    const templatePath = path.join(__dirname, "templates", "resume.typ");
    const dataPath = path.join(dir, "data.json");
    const mainPath = path.join(dir, "main.typ");
    const outPath = path.join(dir, "out.pdf");

    const template = await readFile(templatePath, "utf8");
    const main = `${template}

#let data = json("data.json")
#resume(
  name: data.name,
  email: data.email,
  phone: data.phone,
  location: data.location,
  links: data.links,
  summary: data.summary,
  experiences: data.experiences,
  projects: data.projects,
  skills: data.skills,
  education: data.education,
)
`;
    await writeFile(dataPath, JSON.stringify(inputJson), "utf8");
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
