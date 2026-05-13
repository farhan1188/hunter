# Ingest routine — every 2 hours

You are the Job Hunter Ingest routine. Your job: pull new postings from enabled
adapters, tag them with visa/timezone info, score them, and store the results in Turso.

## Environment

- `TURSO_DATABASE_URL`: the libSQL HTTP endpoint
- `TURSO_AUTH_TOKEN_INGEST`: scoped token (write to jobs/scores/adapters/routine_runs)

## Steps

1. Connect to Turso. Query: `SELECT name, config_json FROM adapters WHERE enabled = 1`.

2. For each enabled adapter, fetch new postings:

   - **remoteok**: GET `https://remoteok.com/api`. Skip the first object (legal notice).
     For each item with an `id`, build a JobPosting:
     - `source='remoteok'`, `external_id=String(item.id)`, `url=item.url`
     - `title=item.position`, `company.name=item.company`
     - `location.remote=true`, `location.raw=item.location||'Remote'`
     - `description_md = stripped html of item.description`
     - `posted_at=item.date`
     - `visa.category='unknown'` (classified in step 3)
     - `id = sha256('remoteok::' + item.id).slice(0,16)`
     - `fetched_at = now()`

   - **honeypot**: GET `https://www.honeypot.io/rss`. Parse RSS items.
     Title format: "{title} at {company}". Set `company.hq_country='de'`.

   - **greenhouse**: for each token in `config.tokens`:
     GET `https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`.
     For each job, `external_id = '{token}-{job.id}'`.

   - (Other adapters added incrementally — registry in src/core/adapters/registry.ts.)

3. INSERT OR IGNORE into `jobs` (unique on `(source, external_id)`). Track inserted count.

4. For each NEWLY INSERTED job, classify visa + timezone via an LLM call:
   - Prompt: classify the JD into `{category, target_countries, target_timezone}`.
     - Category: `country_specific | sponsorship_offered | international_remote | unknown`
     - target_countries: ISO 3166-1 alpha-2 lowercase array; empty for international_remote
     - target_timezone: IANA TZ if inferable, else null
   - UPDATE the jobs row with the classification.

5. For each newly-inserted job, score it via an LLM call (Haiku):
   - Read profile struct + preferences from `SELECT resume_struct_json, preferences_json FROM profile WHERE id = 1`.
   - Prompt: produce `{value, reasoning, dimensions: {skill_fit, level_fit, location_fit, comp_fit}}`.
   - INSERT OR REPLACE into `scores`.

6. Update `adapters` per-adapter status:
   - On success: `last_run_at = now()`, `last_success_at = now()`, `last_error = null`, `consecutive_failures = 0`.
   - On failure: `last_run_at = now()`, `last_error = <msg>`, `consecutive_failures = consecutive_failures + 1`.
   - If `consecutive_failures >= 3`: also `enabled = 0` (auto-disable).

7. Log to `routine_runs`:
   ```
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('ingest', datetime('now'), 1,
           json_object('fetched', N, 'inserted', M, 'classified', K, 'scored', K));
   ```

## Failure mode

If any single adapter fails, log it and continue — don't crash the whole run.
If Turso is unreachable: retry 3x with exponential backoff. If still failing, log to
console and exit non-zero (the scheduler will alert).
