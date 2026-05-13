# Backup routine — nightly at 02:00 UTC

You are the Job Hunter Backup routine. Dump the Turso DB and upload to Drive.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_BACKUP` (read-only token is sufficient)
- `GOOGLE_DRIVE_FOLDER_ID` — root folder; backups go to subfolder `job-hunter-backups`
- Google Drive access (service account or Drive MCP)

## Steps

1. Dump the DB:
   ```
   turso db shell job-hunter --auth-token "$TURSO_AUTH_TOKEN_BACKUP" ".dump" > /tmp/dump.sql
   gzip /tmp/dump.sql
   ```

2. Upload `/tmp/dump.sql.gz` to Drive as `job-hunter-backups/{ISO-timestamp}.sql.gz`.
   - Find or create the `job-hunter-backups` subfolder (mimeType `application/vnd.google-apps.folder`, parent = `GOOGLE_DRIVE_FOLDER_ID`).
   - Upload the gz file with that subfolder as parent.

3. List existing backups in `job-hunter-backups`. If more than 14, delete the oldest until 14 remain.

4. Log to Turso `routine_runs`:
   ```sql
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('backup', datetime('now'), 1, json_object('size_bytes', <bytes>));
   ```

## Failure mode

If Drive upload fails: write a `routine_runs` row with `ok = 0` and the error.
Do NOT delete any existing backups. Try again next run.
