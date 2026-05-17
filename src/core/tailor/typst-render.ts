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
 * Requires `typst` on PATH (install via https://typst.app/docs/quickstart/ or
 * `winget install Typst.Typst` on Windows; `apt install typst` on Linux routines —
 * verify availability in the routine environment as part of setup).
 */
export async function renderResumePdf(input: ResumeRenderInput): Promise<Buffer> {
  // Group selected bullets back into experiences for the template
  const byExp = new Map<string, RankedBullet[]>();
  for (const b of input.selected_bullets) {
    const key = `${b.source_company}|${b.source_title}`;
    if (!byExp.has(key)) byExp.set(key, []);
    byExp.get(key)!.push(b);
  }
  const experiences = input.resume.experience
    .filter((e) => byExp.has(`${e.company}|${e.title}`))
    .map((e) => ({
      company: e.company,
      title: e.title,
      start: e.start,
      end: e.end ?? "present",
      bullets: byExp.get(`${e.company}|${e.title}`)!.map((b) => b.text),
    }));

  const inputJson = {
    name: input.basics.name ?? "",
    email: input.basics.email ?? "",
    phone: input.basics.phone ?? "",
    location: input.basics.location ?? "",
    links: input.basics.links ?? [],
    summary: "",
    experiences,
    projects: [],
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
