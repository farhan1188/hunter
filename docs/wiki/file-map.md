# File map

Annotated tree of what lives where. Grouped by purpose. One-liner per file. Use this to orient quickly; drill into component pages for detail.

Related: [architecture](architecture.md) | [conventions](conventions.md) | [data-model](data-model.md)

---

## Migrations

`src/db/migrations/`

| File | Purpose |
|---|---|
| `001_init.sql` | Phase 1 schema: jobs, scores, profile, settings, adapters, qa_kb, routine_runs |
| `002_last_seen.sql` | Adds `last_seen_at` + `status` to jobs for auto-close logic |
| `003_archetype.sql` | Adds `archetype_match` column to jobs |
| `004_application_pipeline.sql` | v1: applications table, adapter dial columns (`submit_mode`, `daily_cap`, `ats_vendor`), `jobs.apply_url`, `jobs.ats_vendor` |
| `005_qa_deny_list.sql` | Seeds 20 deny-list patterns in `qa_kb`; adds `deny_list` column |

Apply all with `npm run db:migrate`. Idempotent — applied migrations are tracked in `_migrations`.

---

## DB client + types

| File | Purpose |
|---|---|
| `src/db/client.ts` | `getDb()` — creates a `@libsql/client` instance with `cache: 'no-store'` override for Next.js |
| `src/db/migrate.ts` | Migration runner: reads `src/db/migrations/*.sql`, skips already-applied, uses `_migrations` table |
| `src/core/types.ts` | Top-level TypeScript types: `JobPosting`, `JobScore`, `ResumeStruct`, `Profile`, `Preferences`, `AdapterName`, `VisaCategory` |
| `src/core/schemas.ts` | Zod schemas for runtime validation (e.g. `ResumeStructSchema`) |

---

## Adapters

`src/core/adapters/` — one file per job source. Each adapter implements the `Adapter` interface from `types.ts` and returns `JobPosting[]`.

| File | Source | Notes |
|---|---|---|
| `types.ts` | — | `Adapter` interface; base shape all adapters implement |
| `util.ts` | — | `makeJobId`, `nowIso`, `stripHtml` — shared helpers |
| `registry.ts` | — | `getAdapter(name)` / `getRegisteredAdapterNames()` — maps `AdapterName` → instance |
| `remoteok.ts` | RemoteOK API | JSON feed; no auth required |
| `honeypot.ts` | Honeypot (Berlin-focused tech jobs) | GraphQL API |
| `greenhouse.ts` | Greenhouse job boards | Fetches from configured company tokens in `config_json` |
| `lever.ts` | Lever job boards | Similar token-based config |
| `ashby.ts` | Ashby job boards | Similar token-based config |
| `himalayas.ts` | Himalayas.app | REST API; remote-focused |
| `jobicy.ts` | Jobicy | RSS/JSON feed |
| `workingnomads.ts` | Working Nomads | JSON API |
| `weworkremotely.ts` | We Work Remotely | RSS feed |

**Not yet implemented (deferred):** `wellfound.ts`, `otta.ts`, `wttj.ts`, `hired.ts`. Types are registered in `AdapterName` union but no adapter class exists.

---

## Discovery

`src/core/discovery/` — how jobs enter from sources beyond direct adapters.

| File | Purpose |
|---|---|
| `apify-client.ts` | `runActorSync()` — posts to Apify's `run-sync-get-dataset-items` endpoint; returns dataset items array |
| `harvestapi-ingest.ts` | `harvestApiToJobPosting()` — maps HarvestAPI actor output to `JobPosting`; `normalizeAts()` — maps `applicantTrackingSystem` strings to canonical vendor names |
| `import-url.ts` | `importJobFromUrl()` — paste-URL flow: fetch URL, extract OG meta, score, persist, qualify if above threshold |

---

## Applications

`src/core/applications/` — the state-machine spine of v1.

| File | Purpose |
|---|---|
| `types.ts` | `ApplicationState`, `ApplicationChannel`, `QualityGates`, `Application`, `OutreachDraft` type definitions |
| `transitions.ts` | `EDGES` map + `assertValidTransition(from, to)` — throws on illegal state transitions |
| `persist.ts` | `createQualified()`, `transitionApplication()`, `closeForJobs()` — write operations |
| `query.ts` | `getPipelineApplications()`, `getApplicationDetail()`, `getDashboardStats()` — read queries for Hub UI |

---

## Tailoring

`src/core/tailor/` — per-job resume PDF and cover letter generation.

| File | Purpose |
|---|---|
| `bullet-selection.ts` | `selectBullets(resume, jd, maxN)` — deterministic lexical ranking, no LLM; returns top N `RankedBullet[]` by JD-keyword overlap |
| `typst-render.ts` | `renderResumePdf(input)` — groups selected bullets by experience, writes JSON data file, calls `typst compile` CLI, returns PDF `Buffer` |
| `cover-letter.ts` | `generateCoverLetter(input)` — Haiku call; cover letter must include `verbatim_phrase` as exact substring |
| `verbatim-phrase.ts` | `fetchAndSelectVerbatimPhrase(applyUrl)` — fetches apply URL, strips HTML, asks Haiku for a 5-12 word distinctive phrase from company text |
| `templates/resume.typ` | Typst template — rendered by `typst-render.ts`; defines `#resume(...)` function with named parameters |

---

## Quality

`src/core/quality/` — the three gates that run on every tailored application.

| File | Purpose |
|---|---|
| `numerics.ts` | `checkNumerics(bullet, allowed)` — deterministic regex: every digit-run in the tailored bullet must be in the source `numbers[]` allow-list |
| `claim-equivalence.ts` | `judgeClaimEquivalence({original, tailored})` — Haiku call; checks tailored bullet doesn't introduce new scope/tech/ownership claims |
| `gates.ts` | `runQualityGates(input)` — orchestrates all three gates; `allGatesPass(gates)` — returns true only if all three pass |

---

## Q&A KB

`src/core/qa/` — question-and-answer knowledge base used by Submit routine and Local Agent.

| File | Purpose |
|---|---|
| `deny-list.ts` | `matchesDenyList(text, patterns)` — case-insensitive substring match; returns first matched pattern or null |
| `kb.ts` | `listKb(db)`, `findAnswer(db, question)` — read KB entries; used by agent and submit routine |

---

## Submit

`src/core/submit/` — cadence governor and cap accounting.

| File | Purpose |
|---|---|
| `cadence.ts` | `shouldSubmitNow(input)` — checks local hour (09:00-22:00), daily cap, Poisson gap since last submit; `samplePoissonGap(rate)` — exponential inverse-CDF |
| `caps.ts` | `submittedLast24h(db, adapterName?)` / `submittedLast7d(db)` — count submissions for cap enforcement |

---

## Outreach

`src/core/outreach/`

| File | Purpose |
|---|---|
| `draft.ts` | `draftMessage(input)` — Haiku call; 75-100 word LinkedIn DM. `draftOutreach(db, applicationId)` — convenience wrapper that reads job+profile from DB, writes draft to `outreach_drafts` table |

---

## Profile / Settings

`src/profile/`

| File | Purpose |
|---|---|
| `extract.ts` | `extractResume(pdfBytes)` — Sonnet call; parses uploaded PDF into `ResumeStruct` with `numbers[]` per bullet |
| `store.ts` | `getProfile()`, `saveProfile()`, `getSettings()`, `saveSettings()`, `listAdapters()`, `upsertAdapter()` — read/write profile, settings, adapters from Turso |

---

## LLM client

| File | Purpose |
|---|---|
| `src/llm/client.ts` | `getAnthropic()` — cached Anthropic client singleton; `MODEL_SONNET = "claude-sonnet-4-5"` (quality work); `MODEL_HAIKU = "claude-haiku-4-5"` (high-volume cheap calls) |

---

## Lib utilities

`src/lib/`

| File | Purpose |
|---|---|
| `drive.ts` | `getDrive()`, `uploadToDrive()`, `listFiles()`, `deleteFile()` — Google Drive operations via service account |
| `heartbeat.ts` | `staleRoutines()` — checks `routine_runs` for routines overdue by 2× their expected interval |
| `notifier.ts` | `buildDailyDigest()` — builds subject + body for daily email digest (top jobs, broken adapters, stale routines) |

---

## Ingest (Phase 1 holdover)

`src/core/ingest/`

| File | Purpose |
|---|---|
| `classify.ts` | `classifyVisa(posting)` — LLM-based visa category classification |
| `annotate.ts` | Job annotation utilities |
| `archetype.ts` | `classifyArchetypes(profile, postings)` — Haiku batch call; classifies job titles as match/maybe/mismatch against user's target roles |

`src/core/jobs/` and `src/core/scoring/`

| File | Purpose |
|---|---|
| `src/core/jobs/persist.ts` | `insertJobs(db, postings)` — INSERT OR IGNORE jobs into Turso |
| `src/core/jobs/query.ts` | `listFeed()` — job feed query for UI |
| `src/core/scoring/score.ts` | `scoreJob(profile, posting)` — Haiku call; returns 0-100 score with dimensions |
| `src/core/scoring/persist.ts` | `saveScore(db, score)` — writes to `scores` table |

---

## Routine prompts

`routines/` — natural-language markdown prompts executed by the Anthropic `/schedule` runtime. **Not TypeScript.** Do not import from here.

| File | Cron | Purpose |
|---|---|---|
| `harvestapi.md` | `0 6 * * *` | LinkedIn discovery via Apify actor; writes jobs + applications |
| `tailor.md` | `*/30 * * * *` | Picks qualified applications, produces PDF + cover letter, runs quality gates |
| `submit.md` | `*/15 * * * *` | Tier 1 auto-submit (Greenhouse/Lever/Ashby); cadence + caps + deny-list |
| `backup.md` | nightly 02:00 UTC | Dumps Turso → Drive; keeps last 14 backups |
| `reconciler.md` | nightly 03:00 UTC | Orphan PDF cleanup, adapter resurrection, stale job archival |
| `notify-digest.md` | 08:00 Asia/Karachi | Daily digest email via Gmail MCP |
| `ingest.md` | (Phase 1, cron TBD) | Direct adapter crawl (9 non-LinkedIn sources) |

---

## Hub UI

`app/` — Next.js App Router. All pages are server components unless marked; forms are client components.

### Pages

| File | Route | Purpose |
|---|---|---|
| `app/page.tsx` | `/` | Redirects to `/dashboard` |
| `app/dashboard/page.tsx` | `/dashboard` | Today's counts, 7-day funnel, routine health |
| `app/pipeline/page.tsx` | `/pipeline` | Application Kanban (Drafting / Needs review / Ready / Recent); paste-URL form; "Run agent" button |
| `app/pipeline/[id]/page.tsx` | `/pipeline/[id]` | Application detail: cover letter, quality gates, Q&A, outreach draft |
| `app/pipeline/[id]/tabs.tsx` | — | Tab component for the detail page |
| `app/feed/page.tsx` | `/feed` | Raw job feed with score + visa info |
| `app/settings/page.tsx` | `/settings` | Global settings + per-adapter dials |
| `app/profile/page.tsx` | `/profile` | Resume upload + preferences form |
| `app/inbox/page.tsx` | `/inbox` | _TBD: purpose unclear from file alone_ |
| `app/history/page.tsx` | `/history` | _TBD: submitted/closed application history_ |
| `app/layout.tsx` | — | Root layout with nav |

### Client components

| File | Purpose |
|---|---|
| `app/pipeline/paste-url-form.tsx` | Paste-URL input → POST `/api/import-url` |
| `app/pipeline/run-agent-button.tsx` | Triggers POST `/api/agent/run`; shows result |
| `app/feed/filter-bar.tsx` | Source + visa filter UI |
| `app/feed/health-banner.tsx` | Shows stale/broken routine warnings |
| `app/feed/run-now-button.tsx` | Triggers a one-shot crawl run |
| `app/settings/settings-form.tsx` | Global settings form |
| `app/settings/adapters-list.tsx` | Per-adapter enable/disable + dial controls |
| `app/profile/upload-form.tsx` | Resume PDF upload |
| `app/profile/preferences-form.tsx` | Target roles, countries, salary preferences |

### API routes

| File | Method | Purpose |
|---|---|---|
| `app/api/import-url/route.ts` | POST | Paste-URL flow: fetch, extract, score, qualify |
| `app/api/agent/run/route.ts` | POST | Spawns `npm run agent` via `child_process.spawn` |
| `app/api/applications/[id]/review/route.ts` | POST | State transitions: dismiss, approve to ready, mark submitted |
| `app/api/applications/[id]/retry/route.ts` | POST | Re-queue `submit_failed` → `ready` |
| `app/api/applications/[id]/outreach/route.ts` | POST | Draft outreach DM via `draftOutreach()` |
| `app/api/settings/route.ts` | GET/POST | Read/write settings + adapter rows |
| `app/api/qa-kb/route.ts` | GET/POST | Read/write Q&A KB entries |
| `app/api/crawl/route.ts` | POST | Trigger one-shot adapter crawl |
| `app/api/score/route.ts` | POST | Re-score a specific job |
| `app/api/upload/route.ts` | POST | Resume PDF upload + extraction |
| `app/api/preferences/route.ts` | GET/POST | Read/write profile preferences |
| `app/api/annotate/route.ts` | POST | Annotate a job (visa/archetype) |
| `app/api/reclassify/route.ts` | POST | Re-run archetype classification |
| `app/api/trigger/route.ts` | POST | Generic routine trigger |

---

## Local Agent

`agent/` — separate Node ESM project. Has its own `package.json`, `tsconfig.json`, `.env`.

| File | Purpose |
|---|---|
| `agent/src/index.ts` | Entry point: loads config, opens DB, calls `runOneApplication()`, exits |
| `agent/src/config.ts` | `loadConfig()` — reads `agent/.env` via dotenv; returns `cdpUrl`, `tempDir`, `profileBasics` |
| `agent/src/chrome.ts` | `connectToChrome(cdpUrl)` — connects to Chrome via Playwright's `connectOverCDP`; returns `ChromeConnection` |
| `agent/src/state.ts` | `pickNextReady(db)` — queries next `ready` application with `channel = 'local_agent'`; `markFailed(db, ...)` — writes `submit_failed` |
| `agent/src/submit-runner.ts` | `runOneApplication(opts)` — routes to form filler by URL pattern (linkedin / workday / generic); stops before Submit |
| `agent/src/form-fillers/shared.ts` | Shared form-filling helpers |
| `agent/src/form-fillers/generic.ts` | Generic form filler: iterates labels, matches KB, fills fields |
| `agent/src/form-fillers/linkedin-easyapply.ts` | LinkedIn Easy Apply specific flow |
| `agent/src/form-fillers/workday.ts` | Workday-specific form filling |

`agent/` uses path alias `@hub/` → `../src/` to import shared logic (deny-list, KB) from the root project.

---

## Scripts

`scripts/` — local runner equivalents for testing without cloud routine deployment.

| File | `npm run` command | Purpose |
|---|---|---|
| `run-harvestapi.ts` | `npm run ingest:linkedin` | Local equivalent of harvestapi routine; uses `APIFY_API_TOKEN` + `ANTHROPIC_API_KEY` |
| `run-tailor.ts` | `npm run tailor` | Local equivalent of tailor routine; writes PDFs to `./tmp/` |
| `run-adapter.ts` | `npm run ingest` | Runs a named direct adapter |
| `score-feed.ts` | `npm run score` | Re-scores jobs in the feed |
| `annotate.ts` | `npm run annotate` | Annotates jobs with visa + archetype |
| `test-typst.ts` | `npm run test:typst` | Smoke-test for Typst rendering |

---

## Tests

`tests/` — vitest test suite. Run with `npm test`. Focus: `npm test -- <pattern>`.

| Directory | What's tested |
|---|---|
| `tests/applications/` | State machine transitions (`transitions.test.ts`) |
| `tests/discovery/` | Apify client, HarvestAPI ingest mapper, paste-URL import (`import-url.test.ts`) |
| `tests/tailor/` | Bullet selection, cover letter generation, verbatim phrase |
| `tests/quality/` | Numerics check, claim-equivalence judge, gates orchestrator |
| `tests/qa/` | Deny-list matcher |
| `tests/submit/` | Cadence governor |
| `tests/outreach/` | Outreach draft generation |

LLM calls are mocked at module level with `vi.mock("@/src/llm/client", ...)`. Tests with live LLM calls are disabled by default.

---

## Configs / build

| File | Purpose |
|---|---|
| `package.json` | Root project deps + scripts (`dev`, `build`, `test`, `db:migrate`, `ingest:linkedin`, `tailor`, `agent`, etc.) |
| `tsconfig.json` | TypeScript config; `@/` path alias → repo root |
| `vitest.config.ts` | Test runner config; alias mirrors tsconfig |
| `next.config.mjs` | Next.js config; `output: 'standalone'` disabled (local-only use) |
| `.env.example` | All required env vars with placeholders; copy to `.env` and fill |
| `.env` | **Never committed.** Root project secrets: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_FULL`, `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`, `GOOGLE_*` |
| `agent/.env` | **Never committed.** Agent-specific env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_AGENT`, `CHROME_CDP_URL`, `PROFILE_*` |
| `agent/package.json` | Agent project; `"type": "module"` (ESM) |
| `agent/tsconfig.json` | Agent TypeScript config; `@hub/` alias → `../src/` |
