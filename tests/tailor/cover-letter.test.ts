import { describe, it, expect, vi } from "vitest";

// Mock the LLM client to return whatever raw text the test wants, so we can
// verify post-processing (em-dash stripping, placeholder removal) cleanly.
const mockResponseText = vi.hoisted(() => ({ current: "" }));

vi.mock("@/src/llm/client", () => ({
  MODEL_SONNET: "claude-sonnet",
  MODEL_HAIKU: "claude-haiku",
  getAnthropic: () => ({
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: "text", text: mockResponseText.current }],
      })),
    },
  }),
}));

import { generateCoverLetter } from "@/src/core/tailor/cover-letter";

describe("generateCoverLetter", () => {
  it("returns markdown text including the verbatim phrase", async () => {
    mockResponseText.current = `Hi Acme team,\n\nYour "boldly redefining the future of cloud" caught my eye.\n\nFarhan`;
    const letter = await generateCoverLetter({
      profile_name: "Farhan",
      role_title: "Senior PM",
      company_name: "Acme",
      jd_summary: "We need a senior PM for cloud infra.",
      verbatim_phrase: "boldly redefining the future of cloud",
      max_words: 250,
    });
    expect(letter).toContain("boldly redefining the future of cloud");
    expect(letter).toContain("Farhan");
  });

  it("strips em dashes from the model output", async () => {
    mockResponseText.current = "I lead teams — and ship product — at scale.\nFarhan";
    const letter = await generateCoverLetter({
      profile_name: "Farhan", role_title: "PM", company_name: "Acme",
      jd_summary: "x", verbatim_phrase: "", max_words: 250,
    });
    expect(letter).not.toContain("—");
    expect(letter).toContain("I lead teams, and ship product, at scale.");
  });

  it("strips en dashes from the model output", async () => {
    mockResponseText.current = "Worked 2020–2024 on this.\nFarhan";
    const letter = await generateCoverLetter({
      profile_name: "Farhan", role_title: "PM", company_name: "Acme",
      jd_summary: "x", verbatim_phrase: "", max_words: 250,
    });
    expect(letter).not.toContain("–");
    expect(letter).toContain("2020-2024");
  });

  it("removes [Candidate Name] / [Your Name] placeholders if model returns them", async () => {
    mockResponseText.current = "Thanks for considering me.\n\nSincerely,\n[Candidate Name]";
    const letter = await generateCoverLetter({
      profile_name: "Farhan", role_title: "PM", company_name: "Acme",
      jd_summary: "x", verbatim_phrase: "", max_words: 250,
    });
    expect(letter).not.toMatch(/\[\s*(your name|candidate name|name)\s*\]/i);
  });
});
