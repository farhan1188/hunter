import { describe, it, expect, vi } from "vitest";

// Mock the LLM client before importing the cover-letter module.
vi.mock("@/src/llm/client", () => ({
  MODEL_HAIKU: "claude-haiku",
  getAnthropic: () => ({
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: "text", text: `Dear Hiring Manager,\n\nI am excited to apply to the Senior PM role at Acme. Your "boldly redefining the future of cloud" mission resonates with me...\n\nBest,\nUser` }],
      })),
    },
  }),
}));

import { generateCoverLetter } from "@/src/core/tailor/cover-letter";

describe("generateCoverLetter", () => {
  it("returns markdown text including the verbatim phrase", async () => {
    const letter = await generateCoverLetter({
      profile_name: "User",
      role_title: "Senior PM",
      company_name: "Acme",
      jd_summary: "We need a senior PM for cloud infra.",
      verbatim_phrase: "boldly redefining the future of cloud",
      max_words: 250,
    });
    expect(letter).toContain("Acme");
    expect(letter).toContain("boldly redefining the future of cloud");
  });
});
