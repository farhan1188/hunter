import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  assertValidTransition,
} from "@/src/core/applications/transitions";
import type { ApplicationState } from "@/src/core/applications/types";

describe("application state transitions", () => {
  it("allows qualified → tailoring", () => {
    expect(isValidTransition("qualified", "tailoring")).toBe(true);
  });
  it("allows tailoring → quality_review", () => {
    expect(isValidTransition("tailoring", "quality_review")).toBe(true);
  });
  it("allows tailoring → ready", () => {
    expect(isValidTransition("tailoring", "ready")).toBe(true);
  });
  it("allows quality_review → ready", () => {
    expect(isValidTransition("quality_review", "ready")).toBe(true);
  });
  it("allows ready → submitted", () => {
    expect(isValidTransition("ready", "submitted")).toBe(true);
  });
  it("allows ready → submit_failed", () => {
    expect(isValidTransition("ready", "submit_failed")).toBe(true);
  });
  it("allows any non-terminal → dismissed", () => {
    const fromStates: ApplicationState[] = [
      "qualified", "tailoring", "quality_review", "ready", "submit_failed",
    ];
    for (const from of fromStates) {
      expect(isValidTransition(from, "dismissed")).toBe(true);
    }
  });
  it("allows any non-terminal → closed", () => {
    expect(isValidTransition("qualified", "closed")).toBe(true);
    expect(isValidTransition("ready", "closed")).toBe(true);
  });
  it("rejects submitted → tailoring (terminal state)", () => {
    expect(isValidTransition("submitted", "tailoring")).toBe(false);
  });
  it("rejects qualified → submitted (skips required states)", () => {
    expect(isValidTransition("qualified", "submitted")).toBe(false);
  });
  it("assertValidTransition throws on invalid", () => {
    expect(() => assertValidTransition("submitted", "tailoring")).toThrow(
      /illegal transition/i
    );
  });
  it("assertValidTransition does not throw on valid", () => {
    expect(() => assertValidTransition("ready", "submitted")).not.toThrow();
  });
});
