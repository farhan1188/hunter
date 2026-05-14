ALTER TABLE jobs ADD COLUMN archetype_match TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX idx_jobs_archetype ON jobs(archetype_match, source);
