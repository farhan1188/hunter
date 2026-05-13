import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GreenhouseAdapter } from "./greenhouse";

describe("GreenhouseAdapter", () => {
  it("parses /jobs response with one company token", async () => {
    const body = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/greenhouse-sample.json"),
        "utf8"
      )
    ) as { jobs: any[] };

    const a = new GreenhouseAdapter();
    const postings = a.parseJobs("exampleco", body.jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("greenhouse");
    expect(postings[0].external_id).toBe("exampleco-4001");
    expect(postings[0].title).toContain("Staff Engineer");
    expect(postings[0].url).toContain("boards.greenhouse.io");
    expect(postings[0].description_md).toContain("platform");
  });

  it("rejects invalid config", () => {
    const a = new GreenhouseAdapter();
    expect(() => a.validateConfig({})).toThrow();
    expect(() => a.validateConfig({ tokens: [] })).toThrow();
    expect(() =>
      a.validateConfig({ tokens: ["valid"] })
    ).not.toThrow();
  });
});
