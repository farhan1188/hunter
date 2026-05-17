import { describe, it, expect } from "vitest";
import { checkNumerics } from "@/src/core/quality/numerics";

describe("checkNumerics", () => {
  it("passes when bullet's digits all come from source numbers[]", () => {
    expect(checkNumerics("Hired 5 designers and shipped 12 features", ["5", "12"])).toEqual({ pass: true });
  });
  it("fails when a digit appears that isn't in source numbers[]", () => {
    expect(checkNumerics("Hired 5 designers and shipped 25 features", ["5", "12"])).toEqual({
      pass: false,
      reason: expect.stringContaining("25"),
    });
  });
  it("treats years (4-digit numbers in date context) as allowed if user opts in", () => {
    expect(checkNumerics("Worked from 2020-2024", [])).toEqual({ pass: false, reason: expect.any(String) });
  });
  it("normalizes suffixes so bullet '20+' matches allowed '20+'", () => {
    expect(checkNumerics("Lead 20+ engineers", ["20+"])).toEqual({ pass: true });
  });
  it("normalizes both bullet and allow-list (e.g. percent, K/M)", () => {
    expect(checkNumerics("Cut latency 99%", ["99%"])).toEqual({ pass: true });
    expect(checkNumerics("Saved $1.5M annually", ["$1.5M"])).toEqual({ pass: true });
  });
  it("accepts digits that appear in extraContext (company/role text)", () => {
    expect(checkNumerics("Joined Plaid", [], "Plaid 5 (Series E)")).toEqual({ pass: true });
    expect(checkNumerics("Built for the 8 Tower team", [], "8 Tower Capital")).toEqual({ pass: true });
  });
});
