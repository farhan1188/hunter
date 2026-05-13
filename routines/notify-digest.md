# Daily Notifier — 08:00 in user's local timezone (Asia/Karachi = 03:00 UTC)

You are the Job Hunter daily digest sender. Build a summary and send it to the user via Gmail.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_READ`
- Gmail MCP access
- User email: farhan1188@gmail.com

## Steps

1. Connect to Turso. Run:
   - Top jobs:
     ```sql
     SELECT j.title, j.company_name, j.source, j.url, s.value AS score
     FROM jobs j JOIN scores s ON s.job_id = j.id
     WHERE j.archived = 0 AND s.value >= 70
     ORDER BY s.value DESC LIMIT 10
     ```
   - Unhealthy adapters:
     ```sql
     SELECT name, consecutive_failures FROM adapters WHERE consecutive_failures >= 3
     ```
   - Stale routines (any routine with no successful `routine_runs` row in the last 2× its interval — ingest = 240min, others = 48h).

2. Format a plain-text digest. Example shape:

   ```
   Subject: [Job Hunter] N jobs >=70 today

   Job Hunter daily digest — 2026-05-14

   Top jobs (score >= 70): N
     [95] Staff Engineer @ ExampleCo (greenhouse) — https://...
     [88] Senior Backend @ OtherCo (remoteok) — https://...

   Unhealthy adapters: greenhouse
   Stale routines: backup
   ```

3. Send via Gmail MCP. Use `create_draft` to be safe (you can flip to direct send
   later once you trust it).

4. Log to `routine_runs`:
   ```sql
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('notify-digest', datetime('now'), 1, json_object('top_count', N));
   ```

## Failure mode

If Gmail MCP fails: write a `routine_runs` row with `ok = 0` and the error,
then retry next day. Don't crash.
