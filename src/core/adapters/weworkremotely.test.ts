import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";
import { WeWorkRemotelyAdapter } from "./weworkremotely";

describe("WeWorkRemotelyAdapter", () => {
  it("parses RSS items with 'Company: Title' shape", async () => {
    const xml = await readFile(
      path.join(process.cwd(), "tests/fixtures/wwr-sample.xml"),
      "utf8"
    );
    const feed = await new Parser().parseString(xml);
    const a = new WeWorkRemotelyAdapter();
    const postings = a.parseItems(feed.items);
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe("weworkremotely");
    expect(postings[0].company.name).toBe("ExampleCo");
    expect(postings[0].title).toBe("Senior Backend Engineer");
    expect(postings[0].location.remote).toBe(true);
  });
});
