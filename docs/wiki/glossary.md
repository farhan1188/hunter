# Glossary

Alphabetical list of project-specific terms. External terms (Next.js, Playwright, Turso) are defined by their own docs; only project-specific usage is captured here.

Related: [data-model](data-model.md) | [architecture](architecture.md) | [conventions](conventions.md)

---

**adapter** — A TypeScript class that knows how to crawl one job source and return `JobPosting[]`. Adapters implement the `Adapter` interface in `src/core/adapters/types.ts`. Distinct from: a *scraper* (generic term for any web crawler) and an *aggregator* (a job board that aggregates postings from many sources, e.g. Wellfound). Direct adapters hit the source API/feed directly; Apify is a third-party scraping platform, not an adapter in this codebase's sense.

**application** — A row in the `applications` table. Created when a job passes the score threshold and visa filter. The atomic unit of v1. One per job (enforced by `UNIQUE (job_id)`). Distinct from a *job*: a job is raw discovered data; an application is the in-flight submission process for that job. See [data-model](data-model.md).

**archetype filter** — A pre-filter that classifies each job title as `match / maybe / mismatch` relative to the user's target roles before scoring. Implemented in `src/core/ingest/archetype.ts`. Batched Haiku call (up to 20 titles per call). Jobs classified as `mismatch` are skipped at the ingest stage. The `archetype_match` column on `jobs` stores the result.

**Apify** — Third-party scraping platform (`apify.com`) used for LinkedIn job discovery. We run the HarvestAPI actor via Apify's `run-sync-get-dataset-items` endpoint. Apify provides its own authenticated infrastructure so the user's LinkedIn account is never touched. See ADR-008 and ADR-011 in [decisions](decisions.md).

**ATS (Applicant Tracking System)** — Software companies use to manage job applications. Examples: Greenhouse, Lever, Ashby, Workday. The ATS determines what the apply form looks like and which submission tier is used.

**ATS-native** — In this project, specifically Greenhouse, Lever, and Ashby. These three ATS platforms have standardized, predictable forms that make programmatic auto-submit safe. Only ATS-native applications are eligible for Tier 1 (auto-submit). Workday, LinkedIn Easy Apply, and custom career pages are not ATS-native for v1 purposes.

**cadence governor** — Logic in `src/core/submit/cadence.ts` that decides whether a submission should fire right now. Combines three checks: local hour gate (09:00-22:00 in user's timezone), daily cap gate (count vs cap), and Poisson spacing gate (gap since last submit). Returns `{ ok: boolean, reason?: string }`. See also: Poisson cadence.

**CDP (Chrome DevTools Protocol)** — The protocol the Local Agent uses to control Chrome. Playwright's `connectOverCDP()` connects to a Chrome instance running with `--remote-debugging-port=9222`. Requires a dedicated `--user-data-dir` on modern Chrome (see [gotchas](gotchas.md)). Port: 9222 by default.

**channel** — Set on an `applications` row when it transitions to `ready`. Values: `ats_native` (eligible for Tier 1 auto-submit), `local_agent` (Tier 2 click-to-send via Local Agent), `manual` (user will submit entirely by hand). The Submit routine filters on `channel = 'ats_native'`; the Local Agent filters on `channel = 'local_agent'`.

**claim-equivalence** — One of the three quality gates. A Haiku LLM call per bullet pair that checks whether the tailored bullet introduces any claim (scope, technology, team size, ownership, time period, results) absent in the original. Returns `{ equivalent: boolean, divergence_note: string | null }`. Implemented in `src/core/quality/claim-equivalence.ts`. Strict by design — soft drift counts as failure.

**deny-list** — A set of 20 question patterns in `qa_kb` marked `deny_list = 1`. Substring-matched case-insensitively against form question labels. Patterns cover: work authorization, visa, sponsorship, citizenship, EEO, race, gender, ethnicity, disability, veteran status, salary expectation, compensation, notice period, start date. A match **halts submission** and routes the application to `quality_review`. Seeded in migration 005. Implemented in `src/core/qa/deny-list.ts`.

**HarvestAPI** — The specific Apify actor used for LinkedIn discovery: `harvestapi/linkedin-job-search` (console actor id `zn01OAlzP853oqn4Z`). Chosen because it returns full JD text, country codes, apply URLs, and the `applicantTrackingSystem` field. Costs ~$1/1k results. See ADR-011.

**Hub** — The Next.js web app that runs locally at `http://localhost:3000`. Serves the Pipeline Kanban, Dashboard, Feed, Settings, and Profile pages. Also exposes API routes for the frontend and triggers the Local Agent via `POST /api/agent/run`. Never deployed to Vercel — it's a local-only tool. Code lives in `app/`.

**Local Agent** — The Node ESM CLI in `agent/`. Connects to Chrome via CDP, picks the next `ready` application with `channel = 'local_agent'`, fills the form, and stops before Submit. User reviews the filled form and clicks Submit manually. Launched via `npm run agent` or via the "Run agent" button on `/pipeline`. See [components/local-agent](components/local-agent.md).

**Max** — Claude Code Max subscription. Cloud routines run under this subscription, meaning LLM calls made by the Anthropic `/schedule` runtime are covered by the Max plan rather than billed to `ANTHROPIC_API_KEY`. Hub-side LLM calls (paste-URL, profile extraction) ARE billed to `ANTHROPIC_API_KEY`.

**Poisson cadence** — The submission timing strategy. Inter-submit gaps are sampled from an Exponential distribution with rate `dailyCap / 24h`. This mimics organic human behavior better than uniform random jitter. Submit is further gated to waking hours (09:00-22:00 local). See ADR-002 and `src/core/submit/cadence.ts`.

**quality_review** — An application state. Entered when: (a) the Tailor routine ran but ≥1 quality gate failed, (b) the Submit routine hit a deny-list pattern or unknown required question, or (c) the user pushed a `submit_failed` application back for review. The user must triage: approve to `ready` or dismiss. See `settings.quality_review_failure_mode` for the auto-skip alternative.

**routine** — A natural-language markdown prompt in `routines/*.md` that runs on the Anthropic `/schedule` cloud runtime on a cron schedule. Distinct from the Hub (Next.js on localhost) and the Local Agent (Node CLI on user's machine). Routines have no access to Hub TypeScript code; they issue raw HTTP/SQL calls to Turso, Apify, Gmail, Drive. See [architecture](architecture.md).

**scoped Turso token** — A Turso database token provisioned with the minimum permissions needed for a specific runtime. Each routine and the Local Agent get their own scoped token to limit blast radius if a token leaks. See `docs/turso-tokens.md` for the token matrix. The Hub uses `TURSO_AUTH_TOKEN_FULL` (read + write all tables).

**state machine** — The application lifecycle: `qualified → tailoring → quality_review → ready → submitted`. Legal transitions are encoded in `src/core/applications/transitions.ts`. `assertValidTransition(from, to)` throws on illegal edges. `submitted`, `closed`, and `dismissed` are terminal. See [data-model](data-model.md) for the full diagram.

**submit_mode** — A per-adapter column in the `adapters` table. Values: `'off'` (no auto-submit; default), `'click_to_send'` (Tier 2 — agent fills, user clicks), `'auto_submit'` (Tier 1 — fully automated for ATS-native only). Configurable via `/settings`. If `submit_mode = 'auto_submit'` but `daily_cap = 0`, the cadence governor blocks all submissions (see [gotchas](gotchas.md)).

**submission_paused** — Global kill switch in the `settings` table. `1` = all auto-submits suspended regardless of adapter `submit_mode`. Defaults to `1` (paused) on fresh install for safety. The Submit routine checks this first; if paused, it logs and exits immediately. Set to `0` via `/settings` only after manually reviewing the first few tailored applications.

**target_roles** — Array of job title strings in `profile.preferences_json`. Used by the archetype classifier and as job titles input to the Apify actor. Example: `["Senior Backend Engineer", "Staff Engineer", "Engineering Manager"]`.

**target_timezone** — IANA timezone string on the `jobs` table (if inferable from the JD) and `settings.default_target_timezone` (user's working timezone for cadence gating). The cadence governor uses the settings value to determine waking hours. `settings.default_target_timezone` defaults to `'UTC'`; set to `'Asia/Karachi'` for this user.

**Tier 1** — Automatic end-to-end submission. Only for ATS-native jobs (Greenhouse/Lever/Ashby) where the adapter's `submit_mode = 'auto_submit'`. Executed by the Submit cloud routine. Fills and submits the form without user involvement.

**Tier 2** — Click-to-send. For all non-ATS-native jobs (LinkedIn Easy Apply, Workday, custom career pages). The Local Agent fills the form and pauses. The user reviews and clicks Submit. Then marks it submitted via Hub UI. Safer than Tier 1 for unpredictable form structures.

**Typst** — Open-source typesetting system used to render tailored resumes to PDF. The resume template lives at `src/core/tailor/templates/resume.typ`. The render function at `src/core/tailor/typst-render.ts` writes a JSON data file and calls `typst compile` as a child process. Must be on PATH: `winget install Typst.Typst` on Windows. Confirmed working: v0.14.2.

**verbatim phrase** — The third quality gate. A 5-12 word exact substring extracted from the company's own public web content (fetched from `apply_url`) by a Haiku call. The generated cover letter must contain this phrase as an exact substring. Forces cover letters to be genuinely personalized — a phrase from the company's own materials cannot plausibly be AI-generated boilerplate. Implemented in `src/core/tailor/verbatim-phrase.ts` and `src/core/quality/gates.ts`.

**visa_category** — Enum on the `jobs` table. Values:
- `country_specific` — job is restricted to workers in specific countries.
- `sponsorship_offered` — company will sponsor work authorization.
- `international_remote` — genuinely open to workers globally.
- `unknown` — couldn't determine.
Set by `classifyVisa()` in `src/core/ingest/classify.ts`. Used by ingest to filter against `profile.preferences.work_auth_countries` and `open_to_sponsorship_countries`.

**work_auth_countries** — Array of ISO 3166-1 alpha-2 codes in `profile.preferences_json`. Countries where the user already has work authorization (e.g. `["pk"]` for Pakistan). Jobs `country_specific` to these countries are eligible without sponsorship.

**open_to_sponsorship_countries** — Array of ISO codes in `profile.preferences_json`. Countries where the user would accept employer sponsorship (e.g. `["us", "gb", "ca"]`). Jobs with `sponsorship_offered` in these countries are eligible.
