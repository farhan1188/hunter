import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JobicyAdapter } from "./jobicy";

describe("JobicyAdapter", () => {
  it("parses Jobicy v2 API response", async () => {
    const body = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/jobicy-sample.json"),
        "utf8"
      )
    ) as { jobs: any[] };
    const a = new JobicyAdapter();
    const postings = a.parseJobs(body.jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("jobicy");
    expect(postings[0].title).toBe("Senior Engineer");
    expect(postings[0].location.remote).toBe(true);
  });
});
