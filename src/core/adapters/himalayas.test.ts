import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HimalayasAdapter } from "./himalayas";

describe("HimalayasAdapter", () => {
  it("parses jobs API response", async () => {
    const body = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/himalayas-sample.json"),
        "utf8"
      )
    ) as { jobs: any[] };
    const a = new HimalayasAdapter();
    const postings = a.parseJobs(body.jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("himalayas");
    expect(postings[0].title).toBe("Senior Backend Engineer");
    expect(postings[0].location.remote).toBe(true);
    expect(postings[0].company.name).toBe("ExampleCo");
  });
});
