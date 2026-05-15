-- 004_application_pipeline.sql
-- Adds the application-pipeline state machine and related schema deltas.

-- The existing applications table from 001_init.sql was a Phase-3 stub never
-- populated. Drop and recreate with the new state-machine shape.
DROP TABLE IF EXISTS applications;

CREATE TABLE applications (
  id TEXT PRIMARY KEY,                  -- uuid
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                  -- see state machine
  channel TEXT,                         -- 'ats_native' | 'local_agent' | 'manual' | null
  ats_vendor TEXT,                      -- 'greenhouse' | 'lever' | 'ashby' | 'workday' | ... | null
  resume_pdf_path TEXT,                 -- Drive file id or local path
  cover_letter_md TEXT,
  qa_answers_json TEXT NOT NULL DEFAULT '[]',
  quality_gates_json TEXT,
  failure_reason TEXT,
  failure_screenshot_path TEXT,
  tailor_retries INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id)
);

CREATE INDEX idx_applications_state ON applications(state, created_at DESC);
CREATE INDEX idx_applications_channel ON applications(channel, state);

-- Replace outreach_drafts stub.
DROP TABLE IF EXISTS outreach_drafts;

CREATE TABLE outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  target_name TEXT,
  target_linkedin_url TEXT,
  target_role TEXT,
  message_md TEXT NOT NULL,
  copied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_outreach_drafts_application ON outreach_drafts(application_id);

-- Adapter dial columns (per §5.3 of spec).
ALTER TABLE adapters ADD COLUMN submit_mode TEXT NOT NULL DEFAULT 'off';
ALTER TABLE adapters ADD COLUMN ats_vendor TEXT;
ALTER TABLE adapters ADD COLUMN score_threshold INTEGER;
ALTER TABLE adapters ADD COLUMN daily_cap INTEGER;
ALTER TABLE adapters ADD COLUMN last_submit_at TEXT;

-- Seed ats_vendor on existing rows.
UPDATE adapters SET ats_vendor = 'greenhouse' WHERE name = 'greenhouse';
UPDATE adapters SET ats_vendor = 'lever'      WHERE name = 'lever';
UPDATE adapters SET ats_vendor = 'ashby'      WHERE name = 'ashby';

-- Settings additions (per §5.4 of spec).
ALTER TABLE settings ADD COLUMN submission_paused INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN cover_letter_max_words INTEGER NOT NULL DEFAULT 250;
ALTER TABLE settings ADD COLUMN quality_review_failure_mode TEXT NOT NULL DEFAULT 'review';

-- Jobs additions for LinkedIn (distinct read URL vs apply URL).
ALTER TABLE jobs ADD COLUMN apply_url TEXT;
ALTER TABLE jobs ADD COLUMN ats_vendor TEXT;

-- Backfill apply_url = url for existing rows (direct-source jobs apply at the same URL).
UPDATE jobs SET apply_url = url WHERE apply_url IS NULL;

-- Backfill ats_vendor for existing direct-source jobs.
UPDATE jobs SET ats_vendor = 'greenhouse' WHERE source = 'greenhouse';
UPDATE jobs SET ats_vendor = 'lever'      WHERE source = 'lever';
UPDATE jobs SET ats_vendor = 'ashby'      WHERE source = 'ashby';

CREATE INDEX idx_jobs_ats_vendor ON jobs(ats_vendor);
