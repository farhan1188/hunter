import { describe, it, expect } from "vitest";
import { matchesDenyList } from "@/src/core/qa/deny-list";

const patterns = ["work auth", "visa", "salary expectation", "veteran"];

describe("matchesDenyList", () => {
  it("matches case-insensitively as substring", () => {
    expect(matchesDenyList("Confirm your Work Authorization status", patterns)).toBeTruthy();
    expect(matchesDenyList("Will you need visa sponsorship?", patterns)).toBeTruthy();
    expect(matchesDenyList("What's your salary expectation?", patterns)).toBeTruthy();
  });
  it("does not match unrelated text", () => {
    expect(matchesDenyList("Years of React experience?", patterns)).toBeNull();
  });
  it("returns the matched pattern", () => {
    expect(matchesDenyList("Will you need a visa?", patterns)).toBe("visa");
  });
});
