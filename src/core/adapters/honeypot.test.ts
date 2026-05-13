import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HoneypotAdapter } from "./honeypot";

describe("HoneypotAdapter", () => {
  it("parses RSS feed into JobPostings", async () => {
    const xml = await readFile(
      path.join(process.cwd(), "tests/fixtures/honeypot-sample.xml"),
      "utf8"
    );
    const adapter = new HoneypotAdapter();
    const postings = await adapter.parseFeed(xml);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("honeypot");
    expect(postings[0].title).toContain("Backend Engineer");
    expect(postings[0].url).toContain("honeypot.io");
    expect(postings[0].company.hq_country).toBe("de");
  });
});
