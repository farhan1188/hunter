ALTER TABLE jobs ADD COLUMN last_seen_at TEXT;
ALTER TABLE jobs ADD COLUMN status TEXT NOT NULL DEFAULT 'open';

UPDATE jobs SET last_seen_at = fetched_at WHERE last_seen_at IS NULL;

CREATE INDEX idx_jobs_status ON jobs(status, source);
CREATE INDEX idx_jobs_last_seen ON jobs(source, last_seen_at);
