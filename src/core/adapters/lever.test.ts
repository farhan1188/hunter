import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LeverAdapter } from "./lever";

describe("LeverAdapter", () => {
  it("parses Lever postings response", async () => {
    const jobs = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/lever-sample.json"),
        "utf8"
      )
    ) as any[];
    const a = new LeverAdapter();
    const postings = a.parseJobs("exampleco", jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("lever");
    expect(postings[0].external_id).toBe(
      "exampleco-33538a2f-d27d-4a96-8f05-fa4b0e4d940e"
    );
    expect(postings[0].title).toBe("Senior Backend Engineer");
    expect(postings[0].location.remote).toBe(true);
    expect(postings[0].company.hq_country).toBe("us");
    expect(postings[0].description_md).toContain("distributed systems");
  });

  it("rejects invalid config", () => {
    const a = new LeverAdapter();
    expect(() => a.validateConfig({})).toThrow();
    expect(() => a.validateConfig({ sites: [] })).toThrow();
    expect(() => a.validateConfig({ sites: ["valid"] })).not.toThrow();
  });
});
