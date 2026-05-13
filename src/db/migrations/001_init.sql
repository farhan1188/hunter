-- Singleton row: id = 1 always
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  resume_pdf_base64 TEXT,
  resume_filename TEXT,
  resume_uploaded_at TEXT,
  resume_drive_file_id TEXT,
  basics_json TEXT NOT NULL DEFAULT '{}',
  resume_struct_json TEXT,
  preferences_json TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO profile (id) VALUES (1);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_cap INTEGER NOT NULL DEFAULT 0,
  weekly_cap INTEGER NOT NULL DEFAULT 0,
  score_threshold INTEGER NOT NULL DEFAULT 60,
  aggressiveness INTEGER NOT NULL DEFAULT 50,
  token_budget_daily_usd REAL NOT NULL DEFAULT 10.0,
  dry_run INTEGER NOT NULL DEFAULT 1,
  default_target_timezone TEXT NOT NULL DEFAULT 'UTC',
  cadence_floor_minutes INTEGER NOT NULL DEFAULT 30,
  feed_show_country_specific INTEGER NOT NULL DEFAULT 0
);

INSERT INTO settings (id) VALUES (1);

CREATE TABLE adapters (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  last_run_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_hq_country TEXT,
  title TEXT NOT NULL,
  location_remote INTEGER NOT NULL DEFAULT 0,
  location_raw TEXT,
  location_geo TEXT,
  visa_category TEXT NOT NULL DEFAULT 'unknown',
  visa_target_countries_json TEXT NOT NULL DEFAULT '[]',
  target_timezone TEXT,
  description_md TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  raw_ref TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source, external_id)
);

CREATE INDEX idx_jobs_score_ranking ON jobs(archived, fetched_at);
CREATE INDEX idx_jobs_company ON jobs(company_name);

CREATE TABLE scores (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,
  reasoning TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,
  scored_at TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT NOT NULL
);

CREATE INDEX idx_scores_value ON scores(value DESC);

CREATE TABLE qa_kb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,
  answer TEXT NOT NULL,
  user_verified INTEGER NOT NULL DEFAULT 0,
  last_used TEXT
);

CREATE TABLE applications (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  channel TEXT NOT NULL,
  artifact_resume_pdf_path TEXT,
  artifact_cover_letter_md_path TEXT,
  qa_responses_json TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT,
  failure_screenshot_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_applications_state ON applications(state);

CREATE TABLE outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  target_name TEXT NOT NULL,
  target_linkedin_url TEXT NOT NULL,
  target_role TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE routine_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  stats_json TEXT
);

CREATE INDEX idx_routine_runs_recent ON routine_runs(routine, started_at DESC);
