export type ApplicationState =
  | "qualified"
  | "tailoring"
  | "quality_review"
  | "ready"
  | "submitted"
  | "submit_failed"
  | "closed"
  | "dismissed";

export type ApplicationChannel = "ats_native" | "local_agent" | "manual";

export interface QualityGates {
  numerics: "pass" | "fail" | null;
  claim_equiv: "pass" | "fail" | null;
  verbatim_phrase: "pass" | "fail" | null;
  notes?: string;
}

export interface Application {
  id: string;
  job_id: string;
  state: ApplicationState;
  channel: ApplicationChannel | null;
  ats_vendor: string | null;
  resume_pdf_path: string | null;
  cover_letter_md: string | null;
  qa_answers: Array<{ question: string; answer: string }>;
  quality_gates: QualityGates | null;
  failure_reason: string | null;
  failure_screenshot_path: string | null;
  tailor_retries: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachDraft {
  id: number;
  application_id: string;
  target_name: string | null;
  target_linkedin_url: string | null;
  target_role: string | null;
  message_md: string;
  copied_at: string | null;
  created_at: string;
}
