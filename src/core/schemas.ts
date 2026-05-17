import { z } from "zod";

export const AdapterNameSchema = z.enum([
  "remoteok",
  "wellfound",
  "weworkremotely",
  "himalayas",
  "jobicy",
  "workingnomads",
  "otta",
  "honeypot",
  "wttj",
  "hired",
  "greenhouse",
  "lever",
  "ashby",
  "linkedin",
]);

export const VisaCategorySchema = z.enum([
  "country_specific",
  "sponsorship_offered",
  "international_remote",
  "unknown",
]);

export const JobPostingSchema = z.object({
  id: z.string(),
  source: AdapterNameSchema,
  external_id: z.string(),
  url: z.string().url(),
  company: z.object({
    name: z.string(),
    domain: z.string().optional(),
    hq_country: z.string().length(2).optional(),
  }),
  title: z.string(),
  location: z.object({
    remote: z.boolean(),
    raw: z.string(),
    geo: z.string().optional(),
  }),
  visa: z.object({
    category: VisaCategorySchema,
    target_countries: z.array(z.string().length(2)),
  }),
  target_timezone: z.string().optional(),
  description_md: z.string(),
  posted_at: z.string(),
  raw_ref: z.string().optional(),
  fetched_at: z.string(),
});

export const ResumeBulletSchema = z.object({
  text: z.string(),
  numbers: z.array(z.string()),
});

// Sonnet may return null for missing optional fields (e.g. `end: null` for current jobs).
// `.nullish()` accepts string | null | undefined and we normalize null → undefined elsewhere.
const NullishString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

export const ResumeStructSchema = z.object({
  summary: z.string().default(""),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      start: z.string(),
      end: NullishString,
      bullets: z.array(ResumeBulletSchema).default([]),
    })
  ).default([]),
  projects: z.array(
    z.object({
      name: z.string(),
      bullets: z.array(ResumeBulletSchema).default([]),
    })
  ).default([]),
  skills: z.object({
    primary: z.array(z.string()).default([]),
    secondary: z.array(z.string()).default([]),
  }).default({ primary: [], secondary: [] }),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string(),
      year: z.string(),
    })
  ).default([]),
});

export const PreferencesSchema = z.object({
  target_roles: z.array(z.string()).default([]),
  min_salary: z.number().optional(),
  locations: z.array(z.string()).default([]),
  work_auth_countries: z.array(z.string().length(2)).default(["pk"]),
  open_to_sponsorship_countries: z
    .array(z.string().length(2))
    .default(["us", "uk", "ca", "de", "nl", "ie", "au", "ae", "sg"]),
  accept_international_remote: z.boolean().default(true),
  remote_only: z.boolean().default(false),
});
