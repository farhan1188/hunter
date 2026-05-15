import "dotenv/config";
import { renderResumePdf } from "@/src/core/tailor/typst-render";
import { writeFile } from "node:fs/promises";

async function main() {
  const pdf = await renderResumePdf({
    basics: { name: "Test User", email: "t@example.com", phone: "555", location: "Earth", links: [] },
    selected_bullets: [
      { text: "Did a thing", numbers: [], source_company: "Acme", source_title: "PM", score: 0 },
    ],
    resume: {
      experience: [{ company: "Acme", title: "PM", start: "2020", end: "2024", bullets: [{ text: "Did a thing", numbers: [] }] }],
      projects: [], skills: { primary: ["product"], secondary: [] }, education: [],
    },
  });
  await writeFile("test-resume.pdf", pdf);
  console.log("Wrote test-resume.pdf (" + pdf.length + " bytes)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
