import { describe, it, expect } from "vitest";
import { harvestApiToJobPosting, normalizeAts } from "@/src/core/discovery/harvestapi-ingest";
import type { HarvestApiItem } from "@/src/core/discovery/harvestapi-ingest";
import sampleRaw from "@/tests/fixtures/harvestapi-sample.json";
const sample = sampleRaw as unknown as HarvestApiItem[];

describe("harvestapi-ingest", () => {
  it("normalizes ATS vendor names to lowercase canonical form", () => {
    expect(normalizeAts("Greenhouse")).toBe("greenhouse");
    expect(normalizeAts("Lever")).toBe("lever");
    expect(normalizeAts("Ashby")).toBe("ashby");
    expect(normalizeAts("SMART_RECRUITERS")).toBe("smartrecruiters");
    expect(normalizeAts("Workday")).toBe("workday");
    expect(normalizeAts("LinkedIn")).toBe("linkedin");
    expect(normalizeAts(null)).toBeNull();
    expect(normalizeAts("UnknownVendor")).toBeNull();
  });

  it("transforms a Greenhouse-ATS LinkedIn job into a JobPosting with correct apply_url", () => {
    const job = harvestApiToJobPosting(sample[0]);
    expect(job.source).toBe("linkedin");
    expect(job.title).toBe("Product Manager, Data Platform Integrations");
    expect(job.company.name).toBe("Attentive");
    expect(job.url).toBe("https://www.linkedin.com/jobs/view/4414966218/");
    expect(job.apply_url).toBe("https://job-boards.greenhouse.io/attentive/jobs/4247514009?gh_src=63pk6gu69us");
    expect(job.ats_vendor).toBe("greenhouse");
    expect(job.location.raw).toBe("United States");
    expect(job.visa.target_countries).toEqual(["us"]);
    expect(job.description_md).toContain("Attentive");
  });

  it("uses easyApplyUrl as apply_url when companyApplyUrl is null", () => {
    const job = harvestApiToJobPosting(sample[1]);
    expect(job.apply_url).toBe("https://www.linkedin.com/job-apply/4414491812");
    expect(job.ats_vendor).toBe("linkedin");
  });

  it("leaves ats_vendor null when applicantTrackingSystem is null", () => {
    const job = harvestApiToJobPosting(sample[2]);
    expect(job.ats_vendor).toBeNull();
    expect(job.apply_url).toContain("greenhouse");
  });

  it("generates a stable id from the LinkedIn id", () => {
    const a = harvestApiToJobPosting(sample[0]);
    const b = harvestApiToJobPosting(sample[0]);
    expect(a.id).toEqual(b.id);
    expect(a.id).toMatch(/^[a-f0-9]{16}$/);
  });
});
