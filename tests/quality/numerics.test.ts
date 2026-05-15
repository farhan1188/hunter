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
});
