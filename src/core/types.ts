export type AdapterName =
  | "remoteok"
  | "wellfound"
  | "weworkremotely"
  | "himalayas"
  | "jobicy"
  | "workingnomads"
  | "otta"
  | "honeypot"
  | "wttj"
  | "hired"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "linkedin"
  | "manual";

export type VisaCategory =
  | "country_specific"
  | "sponsorship_offered"
  | "international_remote"
  | "unknown";

export interface JobPosting {
  id: string;
  source: AdapterName;
  external_id: string;
  url: string;
  apply_url?: string;
  company: { name: string; domain?: string; hq_country?: string };
  title: string;
  location: { remote: boolean; raw: string; geo?: string };
  visa: { category: VisaCategory; target_countries: string[] };
  target_timezone?: string;
  ats_vendor?: string;
  description_md: string;
  posted_at: string;
  raw_ref?: string;
  fetched_at: string;
}

export interface JobScore {
  job_id: string;
  value: number; // 0–100
  reasoning: string;
  dimensions: {
    skill_fit: number;
    level_fit: number;
    location_fit: number;
    comp_fit?: number;
  };
  scored_at: string;
  model: string;
}

export interface ResumeBullet {
  text: string;
  numbers: string[];
}

export interface ResumeExperience {
  company: string;
  title: string;
  start: string;
  end?: string;
  bullets: ResumeBullet[];
}

export interface ResumeProject {
  name: string;
  bullets: ResumeBullet[];
}

export interface ResumeEducation {
  school: string;
  degree: string;
  year: string;
}

export interface ResumeStruct {
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: { primary: string[]; secondary: string[] };
  education: ResumeEducation[];
}

export interface ProfileBasics {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
}

export interface Preferences {
  target_roles: string[];
  min_salary?: number;
  locations: string[];
  work_auth_countries: string[];
  open_to_sponsorship_countries: string[];
  accept_international_remote: boolean;
  remote_only: boolean;
}

export interface Profile {
  resume_file?: { filename: string; uploaded_at: string };
  basics: ProfileBasics;
  resume_struct?: ResumeStruct;
  preferences: Preferences;
}

export interface AdapterState {
  name: AdapterName;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at?: string;
  last_success_at?: string;
  last_error?: string;
  consecutive_failures: number;
}
