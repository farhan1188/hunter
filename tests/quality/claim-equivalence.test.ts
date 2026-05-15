import { describe, it, expect, vi } from "vitest";

const mockMessages = vi.fn();
vi.mock("@/src/llm/client", () => ({
  MODEL_HAIKU: "claude-haiku",
  getAnthropic: () => ({ messages: { create: mockMessages } }),
}));

import { judgeClaimEquivalence } from "@/src/core/quality/claim-equivalence";

describe("judgeClaimEquivalence", () => {
  it("returns equivalent: true on judged equivalence", async () => {
    mockMessages.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"equivalent": true, "divergence_note": null}' }],
    });
    const r = await judgeClaimEquivalence({
      original: "Hired 5 designers",
      tailored: "Recruited a team of 5 designers",
    });
    expect(r.equivalent).toBe(true);
  });
  it("returns equivalent: false with note when scope expanded", async () => {
    mockMessages.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"equivalent": false, "divergence_note": "Tailored bullet adds team leadership not in source"}' }],
    });
    const r = await judgeClaimEquivalence({
      original: "Built API endpoints for the team",
      tailored: "Led API architecture for a team of 10",
    });
    expect(r.equivalent).toBe(false);
    expect(r.divergence_note).toMatch(/leadership|team/i);
  });
});
