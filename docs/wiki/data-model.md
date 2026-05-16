# Data model

Authoritative reference for the Turso schema + application state machine + invariants.

For the SQL itself, look at `src/db/migrations/*.sql`. This page summarizes the *intent* of each table and the rules that must hold.

---

## Application state machine

```
                              ┌──────────────────────────────────────────┐
                              │                                          ▼
  discovered ──► qualified ──► tailoring ──► quality_review ──► ready ──► submitted
       │              │             │              │              │
       │              │             │              ▼              ▼
       │              │             └─────────► ready       submit_failed
       │              │                                       (re-queue via UI)
       │              │
       └──► dismissed (user) ◄──── any non-terminal state ────► closed (job delisted)
```

### States

| State | Meaning | Set by |
|---|---|---|
| `discovered` | Job in `jobs` table; no `applications` row yet. Implicit; not stored in applications. | Ingest routine |
| `qualified` | Passed archetype + score threshold + visa filter. New `applications` row created. | Ingest routine, or paste-URL flow, or HarvestAPI routine |
| `tailoring` | Tailor routine claimed it; working on artifacts. | Tailor routine |
| `quality_review` | Tailor finished but ≥1 quality gate failed. User must triage. | Tailor routine, or Submit routine (deny-list / unknown required field), or user from `submit_failed` |
| `ready` | All artifacts produced and gates passed. Awaiting submit. | Tailor routine, or user from `quality_review` |
| `submitted` | Successfully went out. Either by Submit routine (Tier 1) or via Local Agent + user click. | Submit routine, or `/api/applications/[id]/review` with action=`mark_submitted` |
| `submit_failed` | Submission attempt failed. **No auto-retry** per architecture decision. | Submit routine |
| `closed` | Job listing closed at source before submission. | Auto-close logic in adapters/persist.ts |
| `dismissed` | User manually dismissed. | `/api/applications/[id]/review` with action=`dismiss` |

### Legal transitions

Encoded in `src/core/applications/transitions.ts`:

```
qualified      → tailoring | dismissed | closed
tailoring      → quality_review | ready | dismissed | closed
quality_review → ready | dismissed | closed
ready          → submitted | submit_failed | dismissed | closed
submitted      → (terminal)
submit_failed  → ready | dismissed
closed         → (terminal)
dismissed      → (terminal)
```

`assertValidTransition(from, to)` throws `illegal transition: from → to` if the edge isn't in the table. Always call this before any UPDATE that changes `state`.

### Invariants

1. **One application per job.** `UNIQUE (job_id)` on `applications`.
2. **`submitted` and `closed` and `dismissed` are terminal.** `submit_failed` has one re-queue path (user-triggered via UI), but that's it.
3. **No auto-retry on `submit_failed`.** Bad submissions are asymmetrically expensive; the user must explicitly re-queue.
4. **`channel` is set at the transition INTO `ready`.** Tailor decides based on `jobs.ats_vendor` whether it's `ats_native` or `local_agent`.
5. **`tailor_retries` is bumped on Tailor exceptions; if ≥3, route to `quality_review`** with note "tailor errored 3x". Prevents infinite retry loops.

---

## Tables

### `profile` (singleton)

Row with `id = 1`. The user's resume + basics + preferences.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | always 1 |
| `resume_pdf_base64` | TEXT | the original uploaded PDF, base64-encoded. Source of truth. |
| `resume_filename` | TEXT | original filename |
| `resume_uploaded_at` | TEXT | ISO timestamp |
| `resume_drive_file_id` | TEXT | Drive file id if uploaded to Drive |
| `basics_json` | TEXT | `{name, email, phone, location, links: string[]}` |
| `resume_struct_json` | TEXT | structured resume from Sonnet extraction at upload time. `{experience[], projects[], skills, education[]}`. Used by Tailor's bullet selection. |
| `preferences_json` | TEXT | `{target_roles, locations, work_auth_countries, open_to_sponsorship_countries, min_salary, remote_only, accept_international_remote}` |

### `settings` (singleton)

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER PK | 1 | |
| `daily_cap` | INTEGER | 0 | global daily submission cap; per-adapter `daily_cap` overrides |
| `weekly_cap` | INTEGER | 0 | |
| `score_threshold` | INTEGER | 60 | per-adapter `score_threshold` overrides; 0-100 |
| `aggressiveness` | INTEGER | 50 | not currently used in v1 |
| `token_budget_daily_usd` | REAL | 10.0 | informational only in v1 |
| `dry_run` | INTEGER | 1 | legacy; redundant with `submit_mode='off'`; will be removed |
| `default_target_timezone` | TEXT | 'UTC' | used by cadence governor |
| `cadence_floor_minutes` | INTEGER | 30 | minimum gap between submits, legacy override |
| `feed_show_country_specific` | INTEGER | 0 | UI: show country-specific jobs in feed/pipeline? |
| `submission_paused` | INTEGER | 1 | **kill switch.** 1 = no auto-submits. Defaults to paused on install for safety. |
| `cover_letter_max_words` | INTEGER | 250 | passed to cover-letter generator |
| `quality_review_failure_mode` | TEXT | 'review' | `'review'` = failed gates go to tray; `'auto_skip'` = silently dismiss |

### `adapters`

One row per registered source. Drives both crawling AND submission routing.

| Column | Type | Default | Notes |
|---|---|---|---|
| `name` | TEXT PK | | adapter name; matches `AdapterName` union |
| `enabled` | INTEGER | 0 | crawl from this source? |
| `config_json` | TEXT | '{}' | adapter-specific config (e.g. `{tokens: ['gitlab','automattic']}` for Greenhouse) |
| `last_run_at` | TEXT | | ISO |
| `last_success_at` | TEXT | | ISO |
| `last_error` | TEXT | | error message of last failed run |
| `consecutive_failures` | INTEGER | 0 | auto-disable when ≥3 |
| `submit_mode` | TEXT | 'off' | `'off' / 'click_to_send' / 'auto_submit'`. **Only applies if `ats_vendor` is set.** |
| `ats_vendor` | TEXT | | 'greenhouse' / 'lever' / 'ashby' / null. Used by Submit routine to route. |
| `score_threshold` | INTEGER | | per-source override; null = use `settings.score_threshold` |
| `daily_cap` | INTEGER | | per-source override; null = use `settings.daily_cap`. **0 ≠ unlimited; the Submit routine refuses to run a source with effective daily_cap=0.** |
| `last_submit_at` | TEXT | | used by cadence governor |

### `jobs`

The pipe of discovered jobs from all sources.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT PK | | `sha256(source + '::' + external_id).slice(0,16)` |
| `source` | TEXT | | adapter name OR `'linkedin'` (from Apify) OR `'manual'` (paste-URL) |
| `external_id` | TEXT | | unique within source |
| `url` | TEXT | | canonical read URL — for LinkedIn jobs, this is `linkedinUrl`, NOT the apply URL |
| `apply_url` | TEXT | | submit target. For direct-source jobs == `url`. For LinkedIn == `applyMethod.companyApplyUrl ?? easyApplyUrl ?? linkedinUrl`. **Always non-null after migration 004 backfill.** |
| `ats_vendor` | TEXT | | normalized ATS vendor (greenhouse/lever/ashby/workday/smartrecruiters/linkedin/jobot) or null. From HarvestAPI for LinkedIn jobs; from `source` for direct ATS adapters. **The Submit routine uses this for Tier-1 eligibility.** |
| `company_name` | TEXT | | |
| `company_domain` | TEXT | | |
| `company_hq_country` | TEXT | | ISO 3166-1 alpha-2 lowercase |
| `title` | TEXT | | |
| `location_remote` | INTEGER | 0 | boolean |
| `location_raw` | TEXT | | original location string |
| `location_geo` | TEXT | | |
| `visa_category` | TEXT | 'unknown' | `country_specific / sponsorship_offered / international_remote / unknown` |
| `visa_target_countries_json` | TEXT | '[]' | array of ISO codes |
| `target_timezone` | TEXT | | IANA TZ if inferable |
| `description_md` | TEXT | | full JD |
| `posted_at` | TEXT | | ISO |
| `raw_ref` | TEXT | | |
| `fetched_at` | TEXT | | ISO |
| `last_seen_at` | TEXT | | bumped on re-encounter; used by auto-close |
| `status` | TEXT | 'open' | `'open' / 'closed'`. Set to `closed` by auto-close logic. |
| `archived` | INTEGER | 0 | unused in v1 |
| `archetype_match` | TEXT | 'unknown' | `'match' / 'maybe' / 'mismatch' / 'unknown'`. Set by archetype pre-filter at crawl. |

Unique constraint: `(source, external_id)`.

### `scores`

One row per scored job.

| Column | Type | Notes |
|---|---|---|
| `job_id` | TEXT PK FK→jobs(id) ON DELETE CASCADE | |
| `value` | INTEGER | 0-100 |
| `reasoning` | TEXT | natural language from scorer |
| `dimensions_json` | TEXT | `{skill_fit, level_fit, location_fit, comp_fit}` |
| `scored_at` | TEXT | ISO |
| `model` | TEXT | e.g. 'claude-haiku-4-5' |

### `applications` (the v1 hub)

The state-machine row. One per job.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | TEXT PK | | UUID generated at creation |
| `job_id` | TEXT FK→jobs(id) ON DELETE CASCADE UNIQUE | | |
| `state` | TEXT | | see state machine above |
| `channel` | TEXT | | `'ats_native' / 'local_agent' / 'manual' / null` — set when transitioning to `ready` |
| `ats_vendor` | TEXT | | denormalized from `jobs.ats_vendor` for query convenience |
| `resume_pdf_path` | TEXT | | Drive file id or local path |
| `cover_letter_md` | TEXT | | the generated cover letter |
| `qa_answers_json` | TEXT | '[]' | array of `{question, answer}` from submission attempts |
| `quality_gates_json` | TEXT | | `{numerics, claim_equiv, verbatim_phrase, notes}` |
| `failure_reason` | TEXT | | populated on `submit_failed` or `quality_review` |
| `failure_screenshot_path` | TEXT | | Playwright screenshot of failure page |
| `tailor_retries` | INTEGER | 0 | bumped on Tailor exceptions |
| `submitted_at` | TEXT | | ISO; set on transition to `submitted` |
| `created_at` | TEXT | datetime('now') | |
| `updated_at` | TEXT | datetime('now') | bumped on every transition |

Indexes:
- `idx_applications_state (state, created_at DESC)` — Pipeline queries
- `idx_applications_channel (channel, state)` — Submit routine + Local Agent queries

### `qa_kb`

The Q&A Knowledge Base. Seeded with 20 deny-list patterns; user adds answers over time.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | | |
| `pattern` | TEXT UNIQUE | | substring matched case-insensitively against form question labels |
| `answer` | TEXT | | empty string until user fills it |
| `user_verified` | INTEGER | 0 | 1 = user provided this answer; submitter can use it |
| `deny_list` | INTEGER | 0 | 1 = halt submission on match (visa/EEO/salary) |
| `last_used` | TEXT | | |

Default behavior: any question matching a `deny_list = 1` pattern halts submission and routes the application to `quality_review`. Questions matching a `user_verified = 1, deny_list = 0` pattern get auto-filled with `answer`. Everything else, if the field is required, halts.

### `outreach_drafts`

One row per drafted LinkedIn DM. Never sent — copy-paste only.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `application_id` | TEXT FK→applications(id) ON DELETE CASCADE | |
| `target_name` | TEXT | usually "Hiring Manager" in v1; refined later |
| `target_linkedin_url` | TEXT | if discoverable |
| `target_role` | TEXT | |
| `message_md` | TEXT | the draft itself |
| `copied_at` | TEXT | timestamped when user clicked "Copy" |
| `created_at` | TEXT | datetime('now') |

### `routine_runs`

Telemetry. Every routine appends one row per run.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `routine` | TEXT | 'ingest' / 'harvestapi' / 'tailor' / 'submit' / 'backup' / 'reconciler' / 'notify-digest' |
| `started_at` | TEXT | datetime('now') |
| `finished_at` | TEXT | |
| `ok` | INTEGER | 1 = success, 0 = failure |
| `error` | TEXT | |
| `stats_json` | TEXT | routine-specific. e.g. `{fetched, inserted, qualified, by_ats: {greenhouse: N, lever: M, ...}}` for harvestapi. |

Used by `staleRoutines()` (in `src/lib/heartbeat.ts`) to surface routines that haven't run recently.

### `_migrations`

Bookkeeping for the migration runner. `(filename TEXT PK, applied_at TEXT)`. Don't touch manually.

---

## Migration index

| File | Date | Purpose |
|---|---|---|
| `001_init.sql` | 2026-05-13 | Phase 1 initial schema |
| `002_last_seen.sql` | 2026-05-13 | adds `last_seen_at` + `status` to jobs (auto-close) |
| `003_archetype.sql` | 2026-05-13 | adds `archetype_match` to jobs |
| `004_application_pipeline.sql` | 2026-05-14 | v1: applications table reshape, adapter dial columns, settings columns, jobs.apply_url + jobs.ats_vendor |
| `005_qa_deny_list.sql` | 2026-05-14 | seed 20 deny-list patterns in qa_kb; add `deny_list` column |

Apply: `npm run db:migrate`. Idempotent; tracks applied migrations in `_migrations`.

---

## libSQL footgun (CRITICAL)

`SELECT *` over the libSQL HTTP client returns wrong column values for many of our columns due to a known bug. **Always list columns explicitly.**

```typescript
// WRONG — will silently return garbage
const { rows } = await db.execute("SELECT * FROM jobs WHERE id = ?");

// RIGHT
const { rows } = await db.execute({
  sql: "SELECT id, source, external_id, url, apply_url, ats_vendor, title, company_name FROM jobs WHERE id = ?",
  args: [jobId],
});
```

This is enforced by convention. There is no linter check. If you write `SELECT *` against `jobs`, `applications`, `profile`, or `settings`, you WILL ship a bug. The existing queries in `src/core/applications/query.ts`, `src/core/jobs/persist.ts`, and `src/profile/store.ts` are the correct templates to follow.
