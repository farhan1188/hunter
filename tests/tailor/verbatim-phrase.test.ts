import { describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

vi.mock("@/src/llm/client", () => ({
  MODEL_HAIKU: "claude-haiku",
  getAnthropic: () => ({
    messages: {
      create: vi.fn(async () => ({
        content: [{ type: "text", text: '{"phrase":"boldly redefining the future of cloud computing","source_excerpt":"At Acme, we are boldly redefining the future of cloud computing."}' }],
      })),
    },
  }),
}));

import { selectVerbatimPhrase, extractTextFromHtml } from "@/src/core/tailor/verbatim-phrase";

describe("verbatim-phrase", () => {
  it("strips HTML to visible text", async () => {
    const html = await readFile(path.join(__dirname, "../fixtures/company-artifact.html"), "utf8");
    const text = extractTextFromHtml(html);
    expect(text).toContain("boldly redefining");
    expect(text).not.toContain("<p>");
  });
  it("Haiku selects a distinctive 5+-word phrase from the artifact", async () => {
    const result = await selectVerbatimPhrase({ source_url: "https://acme.com/about", artifact_text: "..." });
    expect(result.phrase).toBe("boldly redefining the future of cloud computing");
    expect(result.phrase.split(/\s+/).length).toBeGreaterThanOrEqual(5);
  });
});
