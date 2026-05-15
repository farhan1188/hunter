-- 005_qa_deny_list.sql
-- Seed qa_kb with hardcoded sensitive patterns. Matched case-insensitively
-- as substrings against form question text. Any match halts submission and
-- routes the application to quality_review (see §6.4 of spec).

INSERT OR IGNORE INTO qa_kb (pattern, answer, user_verified) VALUES
  ('work auth',          '', 0),
  ('work authorization', '', 0),
  ('authorized to work', '', 0),
  ('sponsor',            '', 0),
  ('sponsorship',        '', 0),
  ('visa',               '', 0),
  ('citizen',            '', 0),
  ('citizenship',        '', 0),
  ('eeo',                '', 0),
  ('race',               '', 0),
  ('gender',             '', 0),
  ('ethnicity',          '', 0),
  ('disability',         '', 0),
  ('veteran',            '', 0),
  ('salary expectation', '', 0),
  ('expected salary',    '', 0),
  ('desired salary',     '', 0),
  ('compensation',       '', 0),
  ('notice period',      '', 0),
  ('start date',         '', 0);

-- Add deny_list flag so the matcher knows these are "halt" patterns
-- rather than user-supplied answers. answer='' + user_verified=0 already
-- functions as a halt signal, but the flag is explicit.
ALTER TABLE qa_kb ADD COLUMN deny_list INTEGER NOT NULL DEFAULT 0;
UPDATE qa_kb SET deny_list = 1 WHERE answer = '' AND user_verified = 0;
