import { describe, it, expect, vi } from "vitest";
import { runQualityGates } from "@/src/core/quality/gates";

vi.mock("@/src/core/quality/claim-equivalence", () => ({
  judgeAllPairs: vi.fn(async () => ({ pass: true })),
}));

describe("runQualityGates", () => {
  it("passes when all gates pass", async () => {
    const result = await runQualityGates({
      tailored_bullets: [{ tailored: "Hired 5 designers", original: "Hired 5 designers", source_numbers: ["5"] }],
      cover_letter: "I would love to join. Boldly redefining the future of cloud is exactly why.",
      verbatim_phrase: "Boldly redefining the future of cloud",
    });
    expect(result.numerics).toBe("pass");
    expect(result.claim_equiv).toBe("pass");
    expect(result.verbatim_phrase).toBe("pass");
  });
  it("fails numerics if a digit isn't in allowed", async () => {
    const result = await runQualityGates({
      tailored_bullets: [{ tailored: "Hired 99 designers", original: "Hired 5 designers", source_numbers: ["5"] }],
      cover_letter: "boldly redefining the future of cloud",
      verbatim_phrase: "boldly redefining the future of cloud",
    });
    expect(result.numerics).toBe("fail");
  });
  it("fails verbatim_phrase if phrase missing from cover letter", async () => {
    const result = await runQualityGates({
      tailored_bullets: [],
      cover_letter: "generic letter with nothing distinctive",
      verbatim_phrase: "boldly redefining the future of cloud",
    });
    expect(result.verbatim_phrase).toBe("fail");
  });
  it("soft-passes verbatim_phrase when no company artifact (phrase is null)", async () => {
    const result = await runQualityGates({
      tailored_bullets: [],
      cover_letter: "any cover letter",
      verbatim_phrase: null,
    });
    expect(result.verbatim_phrase).toBe("pass");
    expect(result.notes).toContain("skipped (no company artifact)");
  });
  it("accepts digits in company name / role title via extraContext", async () => {
    const result = await runQualityGates({
      tailored_bullets: [{
        tailored: "Joined 8 Tower as a 2024 hire",
        original: "Joined 8 Tower as a 2024 hire",
        source_numbers: ["2024"],
      }],
      cover_letter: "x",
      verbatim_phrase: null,
      company_name: "8 Tower Capital",
      role_title: "Senior PM",
    });
    expect(result.numerics).toBe("pass");
  });
});
