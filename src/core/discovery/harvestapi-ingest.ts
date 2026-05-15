import type { JobPosting } from "@/src/core/types";
import { makeJobId, nowIso } from "@/src/core/adapters/util";

export interface HarvestApiItem {
  id: string;
  title: string;
  linkedinUrl: string;
  jobState: string;
  postedDate: string;
  descriptionText: string;
  location: { linkedinText: string; countryCode: string | null; postalAddress: string | null };
  workplaceType: "remote" | "hybrid" | "on_site" | null;
  workRemoteAllowed: boolean;
  easyApplyUrl: string | null;
  applyMethod: { companyApplyUrl: string | null };
  company: { name: string };
  applicantTrackingSystem: string | null;
}

const ATS_MAP: Record<string, string> = {
  greenhouse: "greenhouse",
  lever: "lever",
  ashby: "ashby",
  workday: "workday",
  smart_recruiters: "smartrecruiters",
  smartrecruiters: "smartrecruiters",
  linkedin: "linkedin",
  jobot: "jobot",
};

/** Map HarvestAPI's `applicantTrackingSystem` value to our canonical lowercase form. */
export function normalizeAts(value: string | null): string | null {
  if (!value) return null;
  const k = value.toLowerCase().replace(/[\s_-]/g, "_");
  // Try direct, with underscores collapsed:
  return ATS_MAP[k] ?? ATS_MAP[k.replace(/_/g, "")] ?? null;
}

export function harvestApiToJobPosting(item: HarvestApiItem): JobPosting {
  const externalId = item.id;
  const applyUrl = item.applyMethod.companyApplyUrl ?? item.easyApplyUrl ?? item.linkedinUrl;
  const countryCode = item.location.countryCode?.toLowerCase() ?? null;
  return {
    id: makeJobId("linkedin", externalId),
    source: "linkedin",
    external_id: externalId,
    url: item.linkedinUrl,
    apply_url: applyUrl,
    ats_vendor: normalizeAts(item.applicantTrackingSystem) ?? null,
    company: { name: item.company.name },
    title: item.title,
    location: {
      remote: item.workplaceType === "remote" || item.workRemoteAllowed === true,
      raw: item.location.linkedinText,
    },
    visa: {
      category: countryCode ? "country_specific" : "unknown",
      target_countries: countryCode ? [countryCode] : [],
    },
    description_md: item.descriptionText,
    posted_at: item.postedDate,
    fetched_at: nowIso(),
  };
}
