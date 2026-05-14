# Job Hunter — v1 Application Pipeline (Design)

**Status:** draft for review
**Date:** 2026-05-14
**Supersedes:** the Phase-1 / Phase-2 / Phase-3 framing in `project_goal.md`. v1 collapses Phase 2 and Phase 3 into a single user-facing pipeline that runs end-to-end from "job discovered" to "application submitted."

## 1. Goal

Move from "ranked feed of jobs" to **"queue of in-flight applications that are either submitted or one-click-from-submitted."** The product the user opens each morning is the pipeline, not the feed.

Concretely, on a steady-state day:

- Routines ran overnight: crawled, scored, tailored, and (for enabled ATS sources) auto-submitted up to the daily cap.
- The user opens the Hub to: a digest at the top showing what shipped, a `Ready` column with N click-to-send applications, and a `Needs review` tray with anything the quality gates flagged.
- The user spends ~15–20 minutes clicking through `Ready` and `Needs review`. Done.

## 2. Non-goals (v1)

These were considered and explicitly deferred:

- Workday SSO automation — Local Agent handles Workday via your existing authenticated browser session; no separate SSO handling.
- LinkedIn DM auto-send — drafts only, copy-paste workflow forever. (Architecture decision; ban-risk too high.)
- Per-region timezone routing — single target timezone per user is sufficient.
- Application analytics / funnel dashboards — defer until ≥50 submissions exist worth analyzing.
- Per-archetype autonomy dials — per-source dial is enough; per-archetype adds knobs without clear payoff.
- LinkedIn job-search scraping — only the Saved-Jobs ingester (user-curated) is in scope. No automated search-result harvesting.

## 3. Core concept: application as atomic unit

Today the system's primitive is a *job*. v1's primitive is an *application*. The instant a job passes archetype + score threshold + visa filter, an `applications` row is created in state `qualified`. From there, routines and user actions move it through the state machine.

The existing `jobs` and `scores` tables stay as-is — they're the input pipe. Adapters, archetype classifier, visa classifier, scorer, auto-close — all unchanged.

## 4. State machine

```
                              ┌──────────────────────────────────────────┐
                              │                                          ▼
  discovered ──► qualified ──► tailoring ──► quality_review ──► ready ──► submitted
       │              │             │              │              │
       │              │             │              ▼              ▼
       │              │             └─────────► ready       submit_failed
       │              │                                       (no auto-retry)
       │              │
       └──► dismissed (user) ◄──── any state ────► closed (job delisted at source)
```

**States:**

| State | Meaning | Set by |
|---|---|---|
| `discovered` | Job ingested, not yet qualified | Ingest routine (implicit — `jobs` row only, no `applications` row yet) |
| `qualified` | Passed archetype + score threshold + visa filter | Ingest routine creates `applications` row |
| `tailoring` | Tailor routine working on it | Tailor routine |
| `quality_review` | Tailor finished but a quality gate failed | Tailor routine |
| `ready` | Artifacts produced + quality gates passed; awaiting submit | Tailor routine, or user from `quality_review` |
| `submitted` | Successfully submitted (ATS auto OR user click) | Submit routine (Tier 1) or Local Agent (Tier 2) |
| `submit_failed` | Submission attempt failed | Submit routine. **Never auto-retries.** |
| `closed` | Job listing closed at source before submission | Auto-close logic (already exists) |
| `dismissed` | User manually dismissed | User action |

**Notable transition rules:**

- `qualified → tailoring`: picked up automatically by the Tailor routine. No user action.
- `tailoring → quality_review`: any quality gate failure routes here. Default behavior; the user can flip a settings switch later to `auto_skip` if the tray becomes noisy.
- `quality_review → ready`: user reviewed and accepts.
- `quality_review → dismissed`: user rejected.
- `ready → submitted` (Tier 1, ATS): Submit routine, gated by per-source `submit_mode` + caps + cadence.
- `ready → submitted` (Tier 2, Local Agent): user clicks Submit in the local Playwright UI.
- `submit_failed` never auto-retries. User can manually re-queue from the UI (creates a new `submitted` attempt without clearing the failure record).

## 5. Data model

All schema changes ship in two migrations: `004_application_pipeline.sql` (§5.1, §5.2, §5.3, §5.4) and `005_qa_deny_list.sql` (seed content for §5.5).

### 5.1 New table: `applications`

```sql
CREATE TABLE applications (
  id TEXT PRIMARY KEY,                  -- uuid
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                  -- see state machine
  channel TEXT,                         -- 'ats_native' | 'local_agent' | 'manual' | null until decided
  ats_vendor TEXT,                      -- 'greenhouse' | 'lever' | 'ashby' | null
  resume_pdf_path TEXT,                 -- Drive file id or local path
  cover_letter_md TEXT,
  qa_answers_json TEXT NOT NULL DEFAULT '[]',
  quality_gates_json TEXT,              -- {numerics: 'pass'|'fail', claim_equiv: 'pass'|'fail', verbatim_phrase: 'pass'|'fail', notes: ...}
  failure_reason TEXT,
  failure_screenshot_path TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (job_id)                       -- one application per job
);

CREATE INDEX idx_applications_state ON applications(state, created_at DESC);
CREATE INDEX idx_applications_channel ON applications(channel, state);
```

The existing `applications` table in `001_init.sql` is replaced — it was a stub for Phase 3 that never got populated. Migration handles the upgrade.

### 5.2 New table: `outreach_drafts` (replaces existing stub)

```sql
CREATE TABLE outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  target_name TEXT,
  target_linkedin_url TEXT,
  target_role TEXT,
  message_md TEXT NOT NULL,
  copied_at TEXT,                       -- when user clicked "Copy"
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5.3 Additions to `adapters`

```sql
ALTER TABLE adapters ADD COLUMN submit_mode TEXT NOT NULL DEFAULT 'off';
   -- 'off' | 'click_to_send' | 'auto_submit'
ALTER TABLE adapters ADD COLUMN ats_vendor TEXT;
   -- 'greenhouse' | 'lever' | 'ashby' | null (for non-ATS adapters)
ALTER TABLE adapters ADD COLUMN score_threshold INTEGER;
   -- per-source override; null = use settings.score_threshold
ALTER TABLE adapters ADD COLUMN daily_cap INTEGER;
   -- per-source override; null = use settings.daily_cap
ALTER TABLE adapters ADD COLUMN last_submit_at TEXT;
   -- timestamp of last successful submission; used by cadence governor (§8)
```

Validation: if `submit_mode = 'auto_submit'` and the effective `daily_cap` (per-source override OR `settings.daily_cap`) is 0, the Submit routine refuses to run that source and logs a warning. 0 should not silently mean "unlimited." The Settings UI surfaces this as a red banner.

### 5.4 Additions to `settings`

```sql
ALTER TABLE settings ADD COLUMN submission_paused INTEGER NOT NULL DEFAULT 1;
   -- kill switch; 1 = paused. Flip to 0 to allow auto-submits.
ALTER TABLE settings ADD COLUMN cover_letter_max_words INTEGER NOT NULL DEFAULT 250;
ALTER TABLE settings ADD COLUMN quality_review_failure_mode TEXT NOT NULL DEFAULT 'review';
   -- 'review' (default) | 'auto_skip'
```

The existing `dry_run` column is kept but is now per-source via `submit_mode='click_to_send'` semantics; the global flag becomes redundant. It will be removed in a follow-up migration after v1 ships.

### 5.5 New table: `qa_kb` (replaces existing stub; expanded)

The existing `qa_kb` table is fine structurally — the change is content: we populate the deny-list at install time. See §6.4.

## 6. Components

### 6.1 Tailor routine (new)

**Cadence:** every 30 minutes (cron `*/30 * * * *`).

**Inputs:** all rows where `applications.state = 'qualified'`, limited to N=10 per run to bound cost.

**Outputs:** for each application, produce:
1. **Tailored resume** — `Typst` template rendered to PDF, uploaded to Drive, path stored in `resume_pdf_path`. Bullet selection logic: pick the bullets from `profile.resume_struct_json` whose tags/keywords overlap with the JD; max 8 bullets, ordered by relevance.
2. **Cover letter** — Haiku call with `{profile, jd, company_artifact_snippet}` → ~200-word markdown, stored in `cover_letter_md`. Must include the verbatim-phrase snippet.

**Quality gates** (run after artifact production; details in §7):
- Per-bullet numerics check
- Claim-equivalence Haiku judge
- Verbatim-phrase presence

**Failure handling:**
- Gate failure → `state = 'quality_review'`, `quality_gates_json` records which gates failed.
- Tailor exception → log to `routine_runs`, leave application in `tailoring` state for retry on next cron tick (cap at 3 retries via a counter; after that move to `quality_review` with note "tailor errored").

**Cost:** Tailor runs as a Claude Code routine on Anthropic infrastructure, so LLM cost is covered by the Max subscription. The only out-of-pocket API costs in v1 are: (a) the existing one-shot resume extraction on upload (~$0.05/upload), (b) the Paste-URL flow's JD-extraction call when no structured source exists (~$0.002/paste, executed from the Hub, not a routine), (c) the Outreach drafter (~$0.002/draft). Realistic total: under $2/month barring heavy paste-URL use.

### 6.2 Submit routine — Tier 1 (ATS-native, new)

**Cadence:** every 15 minutes (`*/15 * * * *`).

**Inputs:** all rows where `applications.state = 'ready'` AND `channel = 'ats_native'` AND `settings.submission_paused = 0`.

**Submission logic per row:**

1. Lookup adapter row by `jobs.source`. Read `submit_mode`.
2. If `submit_mode = 'off'`: skip.
3. If `submit_mode = 'click_to_send'`: leave in `ready` for Local Agent / user. (The Local Agent processes both ATS and non-ATS rows when in click-to-send mode for that source.)
4. If `submit_mode = 'auto_submit'`:
   - Check global `daily_cap` (count `submitted_at` in last 24h).
   - Check per-source `daily_cap`.
   - Check Poisson cadence — see §8.
   - If all gates pass: invoke vendor-specific submitter (Greenhouse / Lever / Ashby via Playwright-MCP in routine), capture result, set `state = 'submitted'` and `submitted_at = now()` on success, else `state = 'submit_failed'`.

**Q&A KB integration:** before any submission, check the form's questions (extracted by Playwright) against `qa_kb` deny-list. Any deny-list match → halt this submission, set `state = 'quality_review'` with reason "needs Q&A review", attach the offending question.

### 6.3 Local Agent — Tier 2 (new project, runs on user's Windows machine)

Lives at `agent/` in the repo. A separate Node.js process the user runs manually (`npm run agent`). Connects via CDP to the user's already-running Chrome (preferred — lowest detection risk) or falls back to a persistent Playwright context using the user's Chrome profile directory.

**Two modes:**

#### 6.3.1 Submit mode
Pulls next `state = 'ready'` row that's either:
- ATS-native with `submit_mode = 'click_to_send'`, or
- Non-ATS (any source).

Opens the job URL, fills the form (resume PDF upload, cover letter paste, name/email/etc from profile), answers safe Q&A KB questions automatically, **stops at the Submit button**. Local UI shows the filled form + a big "Submit" button the user clicks. On click, marks `state = 'submitted'`.

#### 6.3.2 LinkedIn Saved-Jobs ingester mode
User-triggered (button in Hub or `npm run agent -- ingest-linkedin`). Connects to user's running Chrome → LinkedIn → My Items → Saved Jobs. Pulls top 25 saved jobs. For each:

- Extract `{title, company, location, jd_text, posted_at, apply_url}`.
- Create `jobs` row with `source = 'linkedin_saved'`.
- Trigger archetype + visa + scoring in-process (reuses existing classifiers).
- If qualified: create `applications` row in `qualified` so the Tailor routine picks it up.

**Anti-ban precautions:**
- CDP-connect to existing Chrome session, don't launch fresh
- Realistic dwell (3–8s per job page)
- User-triggered only, no schedule
- Cap of 25/run, max 2 runs/day enforced by `routine_runs` table check
- No pagination beyond first page

### 6.4 Q&A KB + hardcoded deny-list (new content, table exists)

At install time (migration `004_qa_deny_list.sql`), seed `qa_kb` with patterns:

```
work_auth, work authorization, authorized to work, sponsor, sponsorship,
visa, citizen, citizenship, EEO, race, gender, ethnicity, disability,
veteran, salary expectation, expected salary, desired salary, compensation,
notice period, start date
```

Each row has `user_verified = 0` and `answer = ''`. The submitter matches form question text against `pattern` (case-insensitive substring). Any match → halt + flag.

For non-sensitive questions (e.g. "Years of experience with React?"), if the KB has a `user_verified = 1` answer, use it. Otherwise → halt + flag.

The user populates non-sensitive answers from the `quality_review` tray; once `user_verified = 1` for a pattern, future submissions use it automatically.

### 6.5 Paste-URL flow (new)

Hub adds an input box on the Pipeline page: "Paste a job URL." Triggers `POST /api/import-url { url }`.

Handler:
1. Fetch the URL (server-side `fetch`).
2. Parse:
   - If LinkedIn: extract from embedded JSON (`__INITIAL_DATA__` or `code[type="application/json"]`) — falls back to OG meta + visible text via JD-extraction Haiku call.
   - If Greenhouse/Lever/Ashby URL pattern: hit the corresponding public API for the structured JD.
   - Else: extract title/company from OG tags, full JD body via Haiku JD-extractor (~$0.002 per call).
3. Create `jobs` row with `source = 'manual'`, `external_id = sha256(url).slice(0,16)`.
4. Run archetype + visa + scoring synchronously.
5. If qualified: create `applications` row, redirect user to its detail page.
6. Else: show toast "Score N below threshold; not qualifying."

### 6.6 Outreach drafter (new)

A button on every application card: "Draft LinkedIn DM." Calls `POST /api/outreach/{application_id}`. Handler:
1. Identifies hiring manager / recruiter candidates from the JD text (if mentioned) or returns a placeholder `{target_name: "Hiring Manager"}`.
2. Generates a ~80-word DM draft with Haiku, attached to the application card.
3. User clicks "Copy"; tool stamps `copied_at`. Never sends.

## 7. Quality gates

### 7.1 Per-bullet numerics check
For each bullet in the tailored resume, every digit in the bullet must come from `numbers[]` of the *source* bullet in `resume_struct_json` it was derived from. Implemented as deterministic regex + lookup, no LLM call. Failure means a number was hallucinated.

### 7.2 Claim-equivalence Haiku judge
Inputs: original bullet + tailored bullet. Haiku call: "Does the tailored bullet make any claim (scope, technology, team size, ownership) not present in the original? Answer JSON `{equivalent: bool, divergence_note: string|null}`." Failure means the tailored claim drifted.

### 7.3 Verbatim-phrase personalization
The cover letter must contain at least one **exact substring** (≥5 words) from a web-fetched company artifact (their About/Engineering blog/job description). Stored as `quality_gates_json.verbatim_phrase.source_url`. Failure means the cover letter is generic.

Source for the artifact: `WebFetch` of the company's `apply.url` page + (if available) their `about` page — surfaced by Haiku selecting the most distinctive 5–10 word phrase. Cached per company.

## 8. Cadence governor

For Tier 1 auto-submit only. Per source: minimum gap between submissions sampled from `Exponential(rate)` where `rate = daily_cap / 24h`, evaluated in `target_timezone` (user's). Concretely:

- Each adapter has `last_submit_at` (new column, added in migration).
- On submit attempt, compute `now - last_submit_at`. If `< Exponential.sample(rate)`, skip this attempt; the next cron tick will retry.
- Submissions only happen during waking hours in `target_timezone`: 09:00–22:00 local. Outside → skip.

This avoids the clustered-submission pattern that uniform jitter produces.

## 9. UI surface

### 9.1 Pipeline page (new, primary surface) — replaces Feed as the home view

Four columns:
- **Drafting** (`state IN ('qualified', 'tailoring')`) — read-only progress indicator per row.
- **Needs review** (`state = 'quality_review'`) — primary action area.
- **Ready** (`state = 'ready'` with `submit_mode != 'auto_submit'` OR `channel = 'local_agent'`) — click-to-send queue.
- **Recent** (`state IN ('submitted', 'submit_failed')` in last 7d) — audit trail.

Each card: company name, role, score, channel/vendor, age, primary action (review / send / view).

### 9.2 Application detail (new)
Tabs: `Resume PDF preview` | `Cover letter` | `Quality gates` | `Q&A` | `Outreach draft`. Plus a header with `state`, `submit_mode` (read-only, set on Settings), submit/dismiss buttons.

### 9.3 Settings page (extend existing)
Add a per-adapter table:

| Adapter | ATS vendor | Enabled | Submit mode | Score threshold | Daily cap |

Each row has dropdown selectors. Plus a global "Submission paused" toggle prominently at the top.

### 9.4 Feed page (kept, demoted)
Existing feed page stays as `/feed` for "raw input" inspection — what came in from each adapter regardless of qualification. Linked from the Pipeline page header as "View raw feed."

## 10. Error handling

- **Adapter fetch failure** — existing behavior unchanged (per-adapter failure log + auto-disable after 3 consecutive).
- **Tailor LLM error** — retry counter on the `applications` row, up to 3 attempts; then route to `quality_review` with note.
- **Submit failure** — capture failure screenshot (Playwright) → store path, set `submit_failed`, no auto-retry. User can re-queue via UI.
- **Q&A deny-list match** — halt submission, route to `quality_review`. Never a silent skip.
- **Settings paused** — Submit routine logs "paused, skipping" once per run and exits.
- **Local Agent disconnect** — agent process surfaces error in its console; doesn't mutate DB.
- **Verbatim-phrase artifact unavailable** — if `WebFetch` of the company page fails or Haiku finds no distinctive 5+ word phrase, the verbatim gate fails → `quality_review` with note "no company artifact." User can either accept the generic cover letter and move it to `ready`, or paste a verbatim phrase manually.
- **Submission paused mid-batch** — Submit routine checks `settings.submission_paused` once at start of each row, not just at run start. Flipping the switch while a batch is mid-flight halts after the current row completes.

## 11. Testing strategy

Pragmatic; the goal is shippable not gold-plated. Per `feedback_trim_ceremony.md`, no test pyramid.

**Unit tests (vitest, in `tests/`):**
- Quality gates: numerics check, claim-equiv judge wrapper (mocked Haiku), verbatim-phrase detector.
- Q&A KB deny-list matcher.
- State machine transition validator (legal vs illegal transitions).
- Schema parsers for the new tables.

**Integration tests (vitest):**
- Tailor routine on a fixture profile + fixture JD → produces all artifacts + quality gates pass/fail correctly.
- Paste-URL flow: feed it a fixture HTML, verify the right `jobs` + `applications` rows land.

**Manual smoke tests (documented in `docs/v1-smoke-tests.md`):**
- End-to-end one application: enable one Greenhouse adapter, fix a known job, run Tailor routine, verify Drive PDF + cover letter, verify state moves to `ready`.
- Tier 1 dry: flip Greenhouse to `auto_submit` on a test board (one of the public ones), let it run, confirm submission.
- Tier 2: launch Local Agent in submit mode on a `ready` Lever job, confirm form is filled, abort before clicking Submit.
- LinkedIn Saved-Jobs ingester: save 3 jobs on LinkedIn manually, run agent ingest, confirm `applications` rows land.

No coverage thresholds. The submission paths get manual verification per the spec's checkpoint at Stage 6.

## 12. Build order

| # | Stage | Deliverable | Approx. effort |
|---|---|---|---|
| 1 | DB migration | `004_application_pipeline.sql` — new `applications` table, alterations to `adapters` and `settings`, `005_qa_deny_list.sql` for KB seed | 0.5d |
| 2 | Tailoring engine | Typst renderer + cover letter generator + numerics + claim-equiv + verbatim phrase + Tailor routine prompt | 4–5d |
| 3 | Pipeline UI | `/pipeline` page with 4 columns + application detail tabs + paste-URL input | 2–3d |
| 4 | Settings UI | Per-adapter dial table + paused toggle | 1d |
| 5 | Q&A KB + deny-list | Migration content + matcher utility + UI for adding non-sensitive answers from review tray | 1d |
| 6 | Submit routine — Greenhouse | Playwright-MCP routine + cadence governor + caps | 2–3d |
| | **CHECKPOINT — review first auto-submissions before continuing** | | |
| 7 | Local Agent | `agent/` project; submit mode + LinkedIn Saved-Jobs ingester | 3–4d |
| 8 | ATS expansion | Lever + Ashby submitters | 2d |
| 9 | Outreach drafter | Endpoint + UI button | 1d |

**Total estimated effort:** ~17–22 person-days. Realistic across evenings/weekends: 4–6 weeks.

The checkpoint at Stage 6 is non-negotiable. The cost of a single bad-quality auto-submission is asymmetric (recruiter blacklist; permanent reputation damage), so we eyeball the first ~5–10 submissions manually before flipping more switches.

## 13. Out of scope (recap)

Listed in §2. Worth re-reading before starting any stage to avoid scope drift.

---

## Open questions / things to revisit during build

1. **Typst install** — does Typst need to be installed on the Anthropic routine machine for the Tailor routine to render PDFs? Likely yes; will need to verify and document. Fallback: render via a `typst` Docker image or shell to a JS-based PDF library if Typst install proves painful in routines.
2. **Drive write before Turso** — per `architecture_decisions.md`, Drive write must succeed before the `applications` row is updated with the path. Reconciler already cleans orphan Drive files nightly; verify it handles `applications.resume_pdf_path` too.
3. **Token scoping** — Tailor routine needs write on `applications`, Submit routine needs write on `applications` + read on `qa_kb`. Add to `docs/turso-tokens.md` during Stage 1.
4. **LinkedIn detection** — if the Saved-Jobs ingester triggers a CAPTCHA / restriction, we want a clear failure mode (agent surfaces it, no state change). Test this with an intentional aggressive run early in Stage 7.
