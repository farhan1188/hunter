import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AshbyAdapter } from "./ashby";

describe("AshbyAdapter", () => {
  it("parses Ashby job-board response", async () => {
    const body = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/ashby-sample.json"),
        "utf8"
      )
    ) as { jobs: any[] };
    const a = new AshbyAdapter();
    const postings = a.parseJobs("exampleco", body.jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("ashby");
    expect(postings[0].external_id).toContain("exampleco-");
    expect(postings[0].title).toContain("Engineering Manager");
    expect(postings[0].location.remote).toBe(true);
    expect(postings[0].description_md).toContain("Europe");
  });

  it("rejects invalid config", () => {
    const a = new AshbyAdapter();
    expect(() => a.validateConfig({})).toThrow();
    expect(() => a.validateConfig({ orgs: ["valid"] })).not.toThrow();
  });
});
