-- Autonomous-round settings: when ON, the orchestrator clicks Submit after filling.
-- Default OFF — opt-in only, with explicit UI warning. The existing
-- `submission_paused` master switch still wins (true → nothing sends).
ALTER TABLE settings ADD COLUMN autonomous_auto_submit INTEGER NOT NULL DEFAULT 0;
