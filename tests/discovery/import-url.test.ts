import { describe, it, expect } from "vitest";
import { extractFromHtml } from "@/src/core/discovery/import-url";

describe("import-url.extractFromHtml", () => {
  it("extracts from LinkedIn embedded JSON when present", () => {
    const html = `<html><head>
      <meta property="og:title" content="Senior PM at Acme">
      <meta property="og:description" content="We are hiring a Senior Product Manager...">
      </head><body><script>window.__JOB__ = {...}</script></body></html>`;
    const r = extractFromHtml("https://www.linkedin.com/jobs/view/12345/", html);
    expect(r.title).toBe("Senior PM");
    expect(r.company).toBe("Acme");
    expect(r.description_md).toContain("Senior Product Manager");
  });
  it("falls back to OG tags when no embedded JSON", () => {
    const html = `<html><head>
      <meta property="og:title" content="Backend Eng - Zircon">
      <meta property="og:description" content="Build distributed systems with us">
      </head><body></body></html>`;
    const r = extractFromHtml("https://example.com/careers/eng", html);
    expect(r.title).toContain("Backend Eng");
    expect(r.description_md).toContain("distributed systems");
  });
});
