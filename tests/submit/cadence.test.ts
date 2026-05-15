import { describe, it, expect } from "vitest";
import { shouldSubmitNow, samplePoissonGap } from "@/src/core/submit/cadence";

describe("cadence governor", () => {
  it("samples positive gaps from Exponential(rate)", () => {
    const samples = Array.from({ length: 1000 }, () => samplePoissonGap(0.1, Math.random));
    expect(samples.every((s) => s > 0)).toBe(true);
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(5);   // 1/0.1 = 10, with variance
    expect(mean).toBeLessThan(15);
  });
  it("returns false outside 09:00-22:00 local hours", () => {
    expect(
      shouldSubmitNow({
        now: new Date("2026-05-14T03:00:00Z"),
        timezone: "Asia/Karachi",
        lastSubmitAt: null,
        dailyCap: 10,
        last24h: 0,
      })
    ).toEqual({ ok: false, reason: expect.stringMatching(/hour/i) });
  });
  it("returns true during waking hours when cap not hit", () => {
    expect(
      shouldSubmitNow({
        now: new Date("2026-05-14T08:00:00Z"),
        timezone: "Asia/Karachi",
        lastSubmitAt: null,
        dailyCap: 10,
        last24h: 5,
      }).ok
    ).toBe(true);
  });
  it("returns false when daily cap hit", () => {
    expect(
      shouldSubmitNow({
        now: new Date("2026-05-14T08:00:00Z"),
        timezone: "Asia/Karachi",
        lastSubmitAt: null,
        dailyCap: 5,
        last24h: 5,
      }).ok
    ).toBe(false);
  });
});
