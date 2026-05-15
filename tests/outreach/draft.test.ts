import { describe, it, expect, vi } from "vitest";

const mockMessages = vi.fn();
vi.mock("@/src/llm/client", () => ({
  MODEL_HAIKU: "claude-haiku",
  getAnthropic: () => ({ messages: { create: mockMessages } }),
}));

import { draftMessage } from "@/src/core/outreach/draft";

describe("draftMessage", () => {
  it("returns a short draft mentioning the role and the company", async () => {
    mockMessages.mockResolvedValueOnce({
      content: [{ type: "text", text: "Hi Sarah,\n\nI saw the Senior PM opening at Acme..." }],
    });
    const draft = await draftMessage({
      target_name: "Sarah",
      role_title: "Senior PM",
      company_name: "Acme",
      jd_summary: "We want a senior PM",
      candidate_summary: "10 years of product",
    });
    expect(draft).toContain("Acme");
    expect(draft).toContain("Senior PM");
  });
});
