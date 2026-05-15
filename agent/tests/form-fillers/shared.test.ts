import { describe, it, expect } from "vitest";
import { matchLabelToField } from "../../src/form-fillers/shared.js";

describe("matchLabelToField", () => {
  it("matches 'First Name' label to first_name input", () => {
    expect(matchLabelToField("First Name", ["first_name", "name", "email"])).toBe("first_name");
  });
  it("returns null on no match", () => {
    expect(matchLabelToField("Favorite color", ["first_name", "email"])).toBeNull();
  });
});
