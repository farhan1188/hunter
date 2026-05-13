import { describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { RemoteOKAdapter } from "./remoteok";

describe("RemoteOKAdapter", () => {
  it("parses RemoteOK API response into JobPostings, skipping the legal object", async () => {
    const fixture = await readFile(
      path.join(process.cwd(), "tests/fixtures/remoteok-sample.json"),
      "utf8"
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => JSON.parse(fixture),
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new RemoteOKAdapter();
    const postings = await adapter.fetch({});

    expect(postings).toHaveLength(2);
    expect(postings[0].source).toBe("remoteok");
    expect(postings[0].external_id).toBe("987654");
    expect(postings[0].title).toBe("Senior TypeScript Engineer");
    expect(postings[0].company.name).toBe("ExampleCo");
    expect(postings[0].location.remote).toBe(true);
    expect(postings[0].url).toContain("remoteok.com");
    expect(postings[0].description_md).toContain("Build cool things");
    expect(postings[0].id).toMatch(/^[0-9a-f]{16}$/);
  });
});
