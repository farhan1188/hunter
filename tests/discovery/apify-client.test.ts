import { describe, it, expect, vi, afterEach } from "vitest";
import { runActorSync } from "@/src/core/discovery/apify-client";
import sample from "@/tests/fixtures/harvestapi-sample.json";

describe("apify-client.runActorSync", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("posts to the run-sync-get-dataset-items endpoint with the right shape", async () => {
    type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => new Response(JSON.stringify(sample), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runActorSync({
      actorId: "zn01OAlzP853oqn4Z",
      token: "test-token",
      input: { jobTitles: ["Senior PM"], locations: ["United States"], maxItems: 10 },
    });

    expect(result).toHaveLength(3);
    expect((result[0] as { id: string }).id).toBe("4414966218");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("zn01OAlzP853oqn4Z");
    expect(String(url)).toContain("run-sync-get-dataset-items");
    expect(String(url)).toContain("token=test-token");
    expect(init?.method).toBe("POST");
    const body = JSON.parse((init?.body as string) || "{}");
    expect(body.jobTitles).toEqual(["Senior PM"]);
  });

  it("throws on non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(
      runActorSync({ actorId: "x", token: "t", input: {} })
    ).rejects.toThrow(/apify run failed/i);
  });
});
