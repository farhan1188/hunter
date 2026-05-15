import { describe, it, expect } from "vitest";
import { selectBullets } from "@/src/core/tailor/bullet-selection";
import type { ResumeStruct } from "@/src/core/types";

const resume: ResumeStruct = {
  experience: [
    {
      company: "Acme", title: "PM", start: "2022", end: "2024",
      bullets: [
        { text: "Led migration to Kubernetes, reduced costs by 30%", numbers: ["30"] },
        { text: "Hired 5 designers and shipped 12 features", numbers: ["5", "12"] },
        { text: "Wrote internal Python tooling for SQL data extracts", numbers: [] },
      ],
    },
  ],
  projects: [],
  skills: { primary: ["product", "kubernetes"], secondary: [] },
  education: [],
};

describe("selectBullets", () => {
  it("ranks bullets by keyword overlap with JD", () => {
    const jd = "We need a senior PM who has shipped products on Kubernetes and managed designers.";
    const selected = selectBullets(resume, jd, 2);
    expect(selected).toHaveLength(2);
    // Kubernetes bullet should outrank Python bullet.
    expect(selected[0].text).toContain("Kubernetes");
  });
  it("returns all available when fewer than maxN bullets exist", () => {
    const tiny: ResumeStruct = { ...resume, experience: [{ ...resume.experience[0], bullets: [resume.experience[0].bullets[0]] }] };
    expect(selectBullets(tiny, "x", 5)).toHaveLength(1);
  });
});
