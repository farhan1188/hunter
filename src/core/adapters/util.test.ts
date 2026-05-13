import { describe, it, expect } from "vitest";
import { makeJobId, stripHtml } from "./util";

describe("makeJobId", () => {
  it("is stable for the same input", () => {
    expect(makeJobId("remoteok", "12345")).toBe(makeJobId("remoteok", "12345"));
  });
  it("differs across sources", () => {
    expect(makeJobId("remoteok", "12345")).not.toBe(
      makeJobId("greenhouse", "12345")
    );
  });
  it("returns 16 hex chars", () => {
    expect(makeJobId("remoteok", "x")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <b>world</b>!</p>")).toBe("Hello world !");
  });
  it("decodes common entities", () => {
    expect(stripHtml("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
  });
});
