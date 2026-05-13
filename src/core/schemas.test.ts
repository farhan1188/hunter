import { describe, it, expect } from "vitest";
import { JobPostingSchema, PreferencesSchema } from "./schemas";

describe("schemas", () => {
  it("validates a JobPosting", () => {
    const valid = JobPostingSchema.parse({
      id: "abc",
      source: "remoteok",
      external_id: "12345",
      url: "https://example.com/jobs/12345",
      company: { name: "ExampleCo" },
      title: "Senior Engineer",
      location: { remote: true, raw: "Remote" },
      visa: { category: "international_remote", target_countries: [] },
      description_md: "Hello",
      posted_at: "2026-05-13T00:00:00Z",
      fetched_at: "2026-05-13T00:00:00Z",
    });
    expect(valid.source).toBe("remoteok");
  });

  it("rejects invalid country codes", () => {
    expect(() =>
      JobPostingSchema.parse({
        id: "a",
        source: "remoteok",
        external_id: "1",
        url: "https://x.com",
        company: { name: "X" },
        title: "X",
        location: { remote: false, raw: "" },
        visa: { category: "country_specific", target_countries: ["USA"] },
        description_md: "",
        posted_at: "",
        fetched_at: "",
      })
    ).toThrow();
  });

  it("Preferences defaults Pakistan + sponsorship-friendly countries", () => {
    const prefs = PreferencesSchema.parse({});
    expect(prefs.work_auth_countries).toEqual(["pk"]);
    expect(prefs.open_to_sponsorship_countries).toContain("us");
    expect(prefs.accept_international_remote).toBe(true);
  });
});
