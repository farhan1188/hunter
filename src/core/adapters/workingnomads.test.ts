import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { WorkingNomadsAdapter } from "./workingnomads";

describe("WorkingNomadsAdapter", () => {
  it("parses Working Nomads API response", async () => {
    const jobs = JSON.parse(
      await readFile(
        path.join(process.cwd(), "tests/fixtures/workingnomads-sample.json"),
        "utf8"
      )
    ) as any[];
    const a = new WorkingNomadsAdapter();
    const postings = a.parseJobs(jobs);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("workingnomads");
    expect(postings[0].external_id).toBe("1592331");
    expect(postings[0].title).toBe("Senior Backend Engineer");
    expect(postings[0].location.remote).toBe(true);
  });
});
