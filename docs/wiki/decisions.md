# Architecture Decision Records

Append-only log of load-bearing decisions. Format is ADR-lite. Newest at top.

> When you make a non-obvious technical or product decision, add an ADR. When a later decision supersedes an earlier one, mark the older entry as `superseded by ADR-NN`.

---

## ADR-014: Local-runner scripts for testing without `/schedule` deployment

**Date:** 2026-05-16
**Status:** accepted
**Context:** User had a few API dollars budgeted for testing and wanted end-to-end verification before committing to deploying three cloud routines via `/schedule` on claude.ai.
**Decision:** Add `scripts/run-harvestapi.ts` and `scripts/run-tailor.ts` that run the same logic as the cloud routines but via direct Anthropic API calls (using `ANTHROPIC_API_KEY` from root `.env`).
**Why:** Faster iteration — change a prompt, run a script, see the result in 30 seconds. Cloud routines have a ~5min minimum deploy-and-verify loop.
**Consequences:** Two code paths to maintain (script + routine prompt). For v1 testing this is fine; once routines are stable we can delete the scripts or keep them as a dev-only alternative.

## ADR-013: Use a dedicated Chrome user-data-dir for the Local Agent

**Date:** 2026-05-16
**Status:** accepted
**Context:** Chrome's `--remote-debugging-port` flag is silently dropped when paired with the default Chrome profile (`...\AppData\Local\Google\Chrome\User Data`) — a security mitigation Google added in 2024.
**Decision:** Local Agent connects to a Chrome instance launched with a separate `--user-data-dir` at `C:\Users\<you>\chrome-cdp-profile`.
**Why:** It's the only way to get CDP working on modern Chrome. Side benefit: clean profile with no extensions / ad-blockers that might break job application forms.
**Consequences:** User signs into LinkedIn / Workday once in the dedicated profile. The "Chrome (Job Hunter)" desktop shortcut launches it with both flags. User's regular Chrome is unaffected.

## ADR-012: "Run Agent" button on `/pipeline` spawns the agent process via child_process

**Date:** 2026-05-16
**Status:** accepted
**Context:** User wanted to centralize control — open the platform in a browser, click a button, agent runs. Avoid context-switching to terminals.
**Decision:** `POST /api/agent/run` spawns `npm run agent` in `agent/` directory using `child_process.spawn` (with `npm.cmd` on Windows). Captures stdout/stderr, returns synchronously with exit code + last 4KB of output.
**Why:** Simplest possible integration. Hub runs locally; agent runs locally; spawning a child process is reliable and debuggable.
**Consequences:** Only works when Hub is running locally (`npm run dev`). Won't work if Hub is deployed remotely (Vercel etc) — out of scope for v1 single-user use case. No streaming output; user sees a single result blob when the run finishes. Could upgrade to SSE later if useful.

## ADR-011: Lock HarvestAPI as the canonical LinkedIn discovery actor

**Date:** 2026-05-14
**Status:** accepted
**Context:** Multiple no-cookies LinkedIn job scrapers exist on Apify. Live-tested four candidates (HarvestAPI, FetchClub, Fantastic-Jobs, memo23).
**Decision:** Use `harvestapi/linkedin-job-search` (console actor id `zn01OAlzP853oqn4Z`).
**Why:** Verified live: 20-job test returned full JD text, accurate country codes, applyMethod URLs, and the unexpected goldmine field `applicantTrackingSystem` (used to auto-route Greenhouse/Lever/Ashby jobs to Tier 1 without URL-pattern probing). $1 per 1k results; ~$3-6/month projected at our volume; fits inside Apify's $5 free credit. Fantastic-Jobs had an explicit notice that `external_apply_url` is unavailable, dealbreaker. FetchClub rating dropped to 2.3★.
**Why specifically this over Bright Data:** Bright Data is enterprise-grade with $500+/mo minimums. Overkill for personal use.
**Consequences:** Fallback actor documented: `memo23/apify-linkedin-search-results-scraper`. If HarvestAPI fails persistently we switch.

## ADR-010: Lean dashboard reinstated from non-goals; hunt outcomes deferred

**Date:** 2026-05-14
**Status:** accepted; supersedes the corresponding line in §2 of the spec.
**Context:** Original v1 scope deferred "application analytics / funnel dashboards" until ≥50 submissions exist. User asked for a simple dashboard.
**Decision:** Add `/dashboard` page with today's counts + funnel + 7-day trend + routine health. All data derived from existing tables; no new schema. Hunt-outcome tracking (responses / interviews / offers) stays deferred.
**Why:** Pipeline visibility is essentially free (data already exists). Hunt outcomes need new schema + a workflow for entering events; not worth building until there's enough volume to analyze.
**Consequences:** `/dashboard` becomes the default landing page. When ≥50 submissions exist, follow up with hunt-outcome schema.

## ADR-009: Drop Local Agent's LinkedIn Saved-Jobs ingester

**Date:** 2026-05-14
**Status:** supersedes original Local Agent plan §6.3.2
**Context:** Original Local Agent plan included a "Saved Jobs ingester" mode where the agent would use the user's authenticated Chrome to scrape their LinkedIn Saved Jobs. After we adopted Apify (ADR-011), the discovery role moved to Apify. The Saved-Jobs ingester became redundant.
**Decision:** Local Agent is submit-only. No LinkedIn scraping by the user's Chrome at all.
**Why:** Apify already covers LinkedIn discovery with zero account risk (their infrastructure, their accounts). The Saved-Jobs ingester was in the same risk class as in-browser search — needed mitigation we no longer need. Paste-URL covers the "I saw a specific job" case.
**Consequences:** Local Agent code is simpler. Documentation clearer. LinkedIn account safety improved.

## ADR-008: LinkedIn discovery via Apify (third-party scraping), not user's browser

**Date:** 2026-05-14
**Status:** accepted
**Context:** Need LinkedIn job discovery. Options: (A) Local Agent uses user's authenticated Chrome to scrape; (B) Read LinkedIn job alert emails via Gmail API; (C) Third-party scraping service like Apify or Bright Data.
**Decision:** Apify (option C), specifically a no-cookies actor.
**Why:** Option A puts the user's LinkedIn account at risk of automation detection / ban. Asymmetric cost: losing your professional network is way worse than missing some jobs. Option B has zero risk but ceded query control to LinkedIn's algorithmic email choices. Option C lets us pick our search filters AND keeps the account safe AND fits in Apify's free $5/mo tier at our volume.
**Consequences:** v1 ships with Apify. Local Agent has no LinkedIn-discovery role (see ADR-009). Aggregator adapters (Wellfound / Otta / BuiltIn) are complementary, not primary, for LinkedIn-discovered coverage.

## ADR-007: Application as atomic unit, not job

**Date:** 2026-05-14
**Status:** accepted; foundational to v1
**Context:** Phase 1 had jobs as the primary entity. Feed showed jobs; user could click out to view source. User reported the feed felt "too heavy" — there was no action to take.
**Decision:** Atomic unit becomes the *application*. Every qualified job auto-creates an `applications` row in state `qualified`. The UI is built around application state, not job state.
**Why:** Discovery alone is a solved problem (LinkedIn etc give you more jobs than you can action). The bottleneck is tailoring + applying. Building around "application in flight" makes the UI's daily question concrete: which 5 do I send today?
**Consequences:** Existing jobs/scores tables are preserved as the input pipe. New `applications` table is the spine. Pipeline UI (4-column Kanban: Drafting / Needs review / Ready / Recent) replaces feed as primary surface. Feed kept as `/feed` for raw-input inspection but demoted.

## ADR-006: Two-tier submission; only ATS-native is eligible for auto-submit

**Date:** 2026-05-14
**Status:** accepted
**Context:** How autonomous should submission be?
**Decision:** Tier 1 = ATS-native (Greenhouse / Lever / Ashby) eligible for true auto-submit at low daily cap. Tier 2 = everything else (LinkedIn Easy Apply / Workday / custom career pages) is click-to-send via Local Agent; user clicks Submit manually.
**Why:** Asymmetric cost. ATS forms are standardized and predictable; auto-submit is safe at low volume. Generic forms are unpredictable; one bad submission per blacklisted recruiter outweighs hundreds of successful ones. LinkedIn DMs are NEVER auto-sent — account ban risk too high.
**Consequences:** Per-adapter `submit_mode` dial (`off / click_to_send / auto_submit`) ships in `/settings`. Defaults to `off` for safety. Submit routine reads this dial and routes accordingly. Local Agent is the manual click-to-send vehicle for everything else.

## ADR-005: Three quality gates on every tailored artifact

**Date:** 2026-05-14
**Status:** accepted
**Context:** LLM-generated cover letters and bullet-tailoring can hallucinate or drift. We need guardrails.
**Decision:** Three gates run on every tailored application before it moves to `ready`:
1. **Numerics check** — deterministic regex. Every digit in a tailored bullet must come from the source bullet's `numbers[]` allow-list.
2. **Claim-equivalence judge** — Haiku call per bullet pair. Checks the tailored bullet doesn't introduce scope / technology / team-size / ownership claims absent in the original.
3. **Verbatim phrase** — cover letter must contain at least one exact substring (≥5 words) from a web-fetched company artifact.
**Why:** Numerics catches the most damaging class of hallucination (fake metrics). Claim-equiv catches subtle scope inflation. Verbatim phrase forces personalization — generic letters are an AI signature.
**Consequences:** Failures route to `quality_review` tray by default (settings.quality_review_failure_mode = 'review'). Can flip to 'auto_skip' later if the tray gets noisy.

## ADR-004: Q&A KB with hardcoded deny-list

**Date:** 2026-05-14
**Status:** accepted
**Context:** Application forms ask sensitive questions (visa status, salary expectations, EEO disclosures). We must never auto-answer these.
**Decision:** Seed `qa_kb` with 20 deny-list patterns (work_auth, visa, sponsor, citizenship, EEO, race, gender, ethnicity, disability, veteran, salary expectation, expected salary, desired salary, compensation, notice period, start date). Substring match, case-insensitive. Any match halts submission and routes to `quality_review`.
**Why:** Wrong answer = lawsuit risk / immigration consequences / lost negotiation leverage. Auto-answering is unforgivable.
**Consequences:** User adds non-sensitive answers via the Hub UI (or detail page Q&A tab) over time. Submitter looks up by substring match.

## ADR-003: Outreach is draft-only forever

**Date:** 2026-05-14
**Status:** accepted; foundational architecture decision
**Context:** Should LinkedIn DMs to hiring managers be auto-sent?
**Decision:** No. Draft-only. The tool generates a 75-100 word DM; the user copies, pastes into LinkedIn, sends manually.
**Why:** LinkedIn aggressively bans accounts that send unsolicited DMs at scale. The cost of a ban (losing your professional network) is asymmetrically high compared to the time saved by automation.
**Consequences:** Every outreach draft has a "Copy" button. There is no "Send" button. There will never be a "Send" button. New contributors should not propose adding one.

## ADR-002: Poisson cadence in target timezone, not uniform jitter

**Date:** 2026-05-14
**Status:** accepted
**Context:** Submission cadence — how to space out auto-submits so they don't look automated?
**Decision:** Sample inter-submit gaps from `Exponential(dailyCap / 24h)` in the user's target timezone. Submit only during waking hours (09:00-22:00 local).
**Why:** Uniform jitter clusters in detectable patterns. Poisson better mimics organic user behavior. Submitting at 3am local is the clearest "this is a bot" signal possible.
**Consequences:** Cadence governor in `src/core/submit/cadence.ts`. Submit routine consults it before every send. Out-of-hours sends are deferred to next valid window.

## ADR-001: Turso (libSQL) canonical, plain HTTP client

**Date:** 2026-05-13 (Phase 1)
**Status:** accepted; foundational
**Context:** Where does state live? Options: Drive-as-bus (Drive holding JSON files), embedded SQLite + tunnel, or hosted SQLite.
**Decision:** Turso (hosted libSQL) accessed via `@libsql/client` over plain HTTP. No ORM. Migrations are plain SQL files in `src/db/migrations/`.
**Why:** Drive-as-bus has rate limits and isn't queryable. Local SQLite + tunnel is awkward because cloud routines run on Anthropic infrastructure, not user's laptop. Embedded replica is over-engineering for one user.
**Consequences:** All routine and Hub code talks to the same Turso DB. Scoped tokens per routine bound blast radius. No ORM means SQL is the source of truth; `SELECT *` footgun discovered later (see gotchas).
