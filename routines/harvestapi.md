# HarvestAPI routine — daily LinkedIn discovery

You are the HarvestAPI routine. Once a day you pull fresh LinkedIn jobs via Apify's
no-cookies actor (`harvestapi/linkedin-job-search`), ingest them into Turso, score them,
and create `applications` rows for qualified jobs. Your user's LinkedIn account is
NEVER touched — Apify scrapes from its own infrastructure.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_HARVESTAPI` (scoped — see docs/turso-tokens.md)
- `APIFY_API_TOKEN` — user's personal Apify token

## Steps

1. Connect to Turso. Read profile and settings:
   ```sql
   SELECT preferences_json FROM profile WHERE id = 1;
   SELECT score_threshold, feed_show_country_specific FROM settings WHERE id = 1;
   ```
   Parse `preferences_json` for `target_roles`, `work_auth_countries`,
   `open_to_sponsorship_countries`, `accept_international_remote`.

2. Build the Apify input:
   ```json
   {
     "jobTitles": [...preferences.target_roles],
     "locations": [...locationsFromCountries(work_auth_countries ∪ open_to_sponsorship_countries)],
     "maxItems": 25,
     "sortBy": "date",
     "easyApply": false
   }
   ```
   Country-to-location-name mapping: "us" → "United States", "gb" → "United Kingdom",
   "de" → "Germany", "nl" → "Netherlands", "ie" → "Ireland", "ca" → "Canada",
   "au" → "Australia", "ae" → "United Arab Emirates", "sg" → "Singapore".
   If `accept_international_remote` is true, also include "Worldwide" as a location.
   Cap at 5 locations per run to control cost.

3. POST to Apify:
   `POST https://api.apify.com/v2/acts/zn01OAlzP853oqn4Z/run-sync-get-dataset-items?token=$APIFY_API_TOKEN&clean=true&format=json`
   Body: the input from step 2.
   Synchronous (Apify holds the connection open while the actor runs).

4. For each item in the response, transform via `harvestApiToJobPosting` semantics
   (id = sha256("linkedin::" + item.id).slice(0,16), apply_url precedence:
   applyMethod.companyApplyUrl ?? easyApplyUrl ?? linkedinUrl, ats_vendor =
   normalizeAts(item.applicantTrackingSystem)).

5. INSERT OR IGNORE into `jobs` (UNIQUE on source+external_id is already there).
   For NEW jobs (not skipped by IGNORE):
   - **Classify visa via the classifyVisa prompt FIRST.** The harvestapi-ingest
     mapper defaults `visa_category='unknown'`; the classifier is the source of
     truth. Persist the result with `UPDATE jobs SET visa_category=?, ...`.
   - Score via the scoreJob prompt (Haiku).
   - Qualify ONLY when BOTH of these hold:
     - `score >= settings.score_threshold`, AND
     - `visa_category IN ('international_remote', 'sponsorship_offered')`.
     This is the Pakistan-eligibility gate — country_specific and unknown jobs
     are visible in the UI feed but MUST NOT be auto-qualified. `createQualified()`
     enforces the same gate and returns null on rejected jobs; treat null as
     "skip, do not count as qualified."
   - On qualify: create `applications` row with state='qualified',
     channel=NULL (decided later), ats_vendor=jobs.ats_vendor.

6. Update the `adapters` row with `name = 'linkedin'`:
   ```sql
   UPDATE adapters SET last_run_at = datetime('now'), last_success_at = datetime('now'),
                       last_error = NULL, consecutive_failures = 0
   WHERE name = 'linkedin';
   ```

7. Log:
   ```sql
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json) VALUES (
     'harvestapi', datetime('now'), 1,
     json_object('fetched', N, 'inserted', M, 'qualified', K,
                 'by_ats', json_object('greenhouse', G, 'lever', L, 'ashby', A, 'workday', W, 'other', O))
   );
   ```

## Failure modes

- Apify API non-2xx: log error to routine_runs (ok=0), `adapters.last_error`. Skip this run.
- Out of Apify credits: response includes a specific error; surface that in last_error.
- Item parse error on a single job: skip that job, continue with the rest.
- LinkedIn ban/detection by Apify (rare since they rotate accounts): same as API error;
  we'll see it in last_error and pick a different actor if it persists.
