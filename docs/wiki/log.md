# Session log

Append-only chronological record of meaningful work. Newest at top. Format:

```
## [YYYY-MM-DD] <topic> — <one-line summary>

- Bullet points of what changed
- Commit SHAs where relevant
- Decisions made (link to ADR if added)
- Open questions raised
```

---

## [2026-05-18] MCP-driven submission + 2Captcha + reality check on the Pakistan-eligible PM pool

Long session pursuing "/goal apply to 10 Pakistan-eligible jobs". Net: **2 real confirmed submissions** + significant architectural progress + an honest read on the market.

**Submissions confirmed (Pakistan-eligible)**:
- Watermark Insights — Senior Growth Product Manager, Virtual, Dayforce ATS. Confirmation #90DlTevC. User solved reCAPTCHA mid-flow.
- Canonical — Solution Architecture Manager, Home based / Worldwide, Greenhouse. Reached confirmation page, no captcha.

**Architecture built (committed earlier this session: `5b6dbe5`, `44b0ef9`, `893bbae`, `6e84d73`, `65f03cf`)**:
- Pakistan-eligibility gate at `createQualified()`.
- Paranoid visa classifier with deterministic post-checks (regional remote, "Headquarters: X", US-city presence, "Remote - USA").
- Cover-letter PDF rendering (`src/core/tailor/cover-letter-render.ts`) and agent attachment across greenhouse / lever / generic fillers.
- Generic filler: Apply-CTA detection (handles JD→Apply→Auth-choice multi-step flows on Dayforce/BairesDev/etc), cookie banner dismissal.
- Greenhouse filler: legal-name custom-question variants, family-member / personal-relationship patterns, generic Yes/No knockout fallback.
- 2Captcha integration (`agent/src/captcha-solver.ts`, `agent/src/form-fillers/captcha-handle.ts`) — wired into greenhouse/lever/generic fillers but dormant until `TWOCAPTCHA_API_KEY` is set.
- 24 globally-friendly Greenhouse tokens seeded (`scripts/seed-greenhouse-tokens.ts`).
- RJF API ingest with authoritative Greenhouse JD fetch (`agent/scripts/ingest-rjf-api.ts`).

**Key learning saved as skill**: `~/.claude/skills/mcp-driven-job-application` — the right pattern for ATS forms the auto-filler can't handle is to drive Playwright MCP directly (read snapshot, fill fields, click submit). Skill captures: the 4-step pattern, when to use it, the 2Captcha-vs-pause decision, the field-conventions table for Farhan's profile.

**Memories saved** (5 new): `feedback_look_at_browser`, `reference_remote_job_sources`, `user_education_and_self_framing` (2.7 GPA + EE-was-wrong-fit framing), `feedback_no_em_dashes` (HARD RULE — em dashes are the #1 AI tell, ban in all user-facing text), and `feedback_gmail_source_of_truth`.

**Reality check on the Pakistan-eligible AI PM/Solutions market**:
- RJF API's `type: "worldwide"` was wrong on every candidate inspected (Counterpart Health, Clover Health, Atlassian, DEPT, Camunda, CXT, Simple Life, Avalere — all actually US/EU/regional). RJF's tagging is unreliable.
- Greenhouse 24-token seed (4200+ jobs across gitlab/canonical/mozilla/stripe/elastic/figma/vercel/mongodb/contentful/remote/n26/airbnb/algolia/cloudflare/datadog/sumup/grafanalabs/trustpilot/circleci/pinterest/squarespace/lyft/instacart/roblox) classified ~700 active. Of those, only Canonical's 34 roles surfaced as truly Pakistan-eligible PM/Solutions fit.
- LinkedIn AI-targeted batch (8 AI titles × US/UK/Worldwide, 125 jobs) yielded 4 eligibility-pass roles — all wrong-fit (BairesDev gated, Arm CPU eng, BSI medical-device sw, Aurora Energy AI eng).
- Direct AI-startup careers pages (Modal/Pinecone/Replicate-now-Cloudflare): Modal is NYC/SF/Stockholm, Pinecone is US-Remote, Replicate folded into Cloudflare.

**The pool is genuinely thin.** The intersection of (Pakistan-eligible) × (PM/Solutions/AI fit) × (working apply form) is small. The architecture works. The 10-target tonight wasn't achievable not because of pipeline bugs but because of actual market scarcity in that niche.

**Next-session approach** (not pursued tonight): curated YC AI startup prospecting via workatastartup.com; known-PK-hire orgs (Toptal/Andela/Turing/Crossover); direct founder outreach via LinkedIn DM.

---

## [2026-05-17] Pakistan-eligibility gate + search-radius expansion

Investigation triggered by the user noticing that 2 of the 3 "successful" submissions (Airbnb + Axon) were US-only roles — applying to them from Pakistan is a waste at best and a profile-pollution risk at worst.

- **Root cause:** `harvestApiToJobPosting` (src/core/discovery/harvestapi-ingest.ts:57) hard-coded `category='country_specific'` whenever LinkedIn returned a country code, never deferring to the LLM classifier. Combined with `scripts/uncap-and-qualify.ts` flipping everything ≥50 score to qualified regardless of visa, the pipeline happily queued 38 US-only roles for auto-submit.
- **Cleanup:** `scripts/purge-non-pakistan-eligible.ts` archived 61 country_specific jobs and dismissed 44 in-flight applications (40 ready/quality_review + 4 submit_failed). The 2 already-submitted on Airbnb/Axon stay as terminal history.
- **Code gate:** `createQualified()` in `src/core/applications/persist.ts` now reads `visa_category` from the parent job and returns `null` (skip) unless it's in `ELIGIBLE_VISA_CATEGORIES = ['international_remote', 'sponsorship_offered']`. Callers (`uncap-and-qualify.ts`, `run-harvestapi.ts`, `import-url.ts`) updated to handle null and count correctly. Routine spec at `routines/harvestapi.md` step 5 rewritten to make the gate explicit.
- **Harvestapi mapper fixed:** defaults `visa.category='unknown'` so the LLM classifier always gets to make the real call.
- **Search radius widened:** seeded 4 missing global-remote adapters (weworkremotely, himalayas, jobicy, workingnomads) into the `adapters` table (`scripts/seed-remote-adapters.ts`); they were already in the code registry but never enabled in DB. Bumped `run-harvestapi.ts` defaults from 3×3×5 (~45 jobs/run) to 5×5×8 (~200 jobs/run). Dropped Pakistan from LinkedIn search locations (returns local roles); added "Worldwide" first when `accept_international_remote=true`.
- **Honest read on submission verification:** the `state='submitted'` in the DB is heuristic-only (`finishForm`'s URL+body-text check in `agent/src/form-fillers/shared.ts:160`). Audit screenshot save is silently catching errors; no on-disk artifacts exist. Gmail confirmation emails are the only reliable signal. Saved as feedback memory.
- **Memories added:** `feedback_gmail_source_of_truth.md`, `feedback_pakistan_strict_targeting.md`.

After: 12 active jobs (all `international_remote`), 7 ready, 1 submitted (Cove). 2 country_specific submissions preserved as history.

## [2026-05-17] Goal session — humanize cover letters, fix UI gaps, new resume

- **New resume imported** from `Farhan_Ahmed_Khan_Resume.docx`. Added `mammoth` for .docx → text extraction, plus `extractResumeFromText` in `src/profile/extract.ts` (parallel to the existing PDF path) and two one-shot scripts (`scripts/import-resume-docx.ts`, `scripts/import-basics-docx.ts`). Basics now populated from the resume header (name, email, phone, location, LinkedIn).
- **Cover letters humanized.** Rewrote the prompt in `src/core/tailor/cover-letter.ts`: switched to Sonnet, banned em/en dashes + LLM clichés ("I am writing to express", "passionate about", "leverage", "moreover", etc.), required structure (3 short paras, specific opening, no sycophancy), and grounds the letter in top resume bullets (`highlight_bullets` parameter). Added a post-process `cleanLetter` pass that strips dashes and `[Candidate Name]` placeholders. Validated: 8/8 existing letters now have 0 dashes and 0 LLM tells.
- **Job ingest dedupe**: `insertJobs` now deduplicates within a single batch — the same LinkedIn job can surface in multiple search queries within one run, which previously crashed on the UNIQUE constraint.
- **Pipeline UI overhaul:**
  - Nav: added Dashboard + Pipeline, dropped Inbox/History stubs, added current-page indicator.
  - Dashboard: replaced the "Stale routines: ingest, backup, ..." gibberish with a "Today" hero card and an `Open pipeline →` CTA.
  - Pipeline cards: color-coded score chips (green ≥85, blue ≥75, yellow ≥60), location chip (Remote / city), ATS tag, posted-time. Empty columns get explanatory hints.
  - Detail page: tabs now stack correctly above the panel (was a Tailwind data-attribute mismatch in `components/ui/tabs.tsx`); cover letter renders as proper paragraphs with a Copy button + word count; **Resume tab embeds the actual PDF inline** via a new `/api/applications/[id]/resume` route (defends against path traversal); quality gates show green/red badges with readable labels.
  - Action buttons rephrased to plain English ("Approve and move to Ready" / "Skip this job"; "Run Agent (send next Ready)" with hover tooltip).
- **Quality gates notes** no longer start with stray `| ` (clean `noteParts.join(" | ")`).
- **8 ready-to-send apps** at the end of the session, all with the new prompt + new resume. Tests: 73 passing.

## [2026-05-16] First live ingest+tailor cycle — fixed Apify input shape, Typst PATH, JSON parse

- **Apify token added** to root `.env` and verified via 5-row ingest.
- **Fixed HarvestAPI input shape** in `scripts/run-harvestapi.ts`. The script was sending `searchQueries`/`locationNames`/`publishedAt` (none in the actor's schema), so Apify ignored the keyword filter and returned random global jobs (Receiving Manager, Attorney, Spanish logistics coordinator). Real schema is `jobTitles[]`, `locations[]`, `maxItems` (per title×location pair). Also: `pk` was missing from `COUNTRY_NAMES` so `work_auth=['pk']` collapsed to "United States" only; and `open_to_sponsorship_countries` (the actual targets) was ignored — fixed by unioning sponsorship-first.
- **Added `--titles` and `--locations` CLI flags** to `run-harvestapi.ts` to control cost (defaults: 3 titles × 3 locations × maxItems=5).
- **Second ingest (2 titles × 2 locations × 3 rows)** returned 9 on-topic senior PM jobs. 2 qualified above threshold 75: Zillow Senior PM Data Platform (92), Gogo AI PM (82).
- **Fixed `spawn typst ENOENT`** by introducing `TYPST_BIN` env override in `src/core/tailor/typst-render.ts:82`. Winget installs typst at `…\WinGet\Packages\Typst.Typst_…\typst-x86_64-pc-windows-msvc\typst.exe` and doesn't always shim it onto PATH. Pointing `TYPST_BIN` at that absolute path works; added to `.env` and gotchas.
- **Hardened claim-equivalence JSON parser** at `src/core/quality/claim-equivalence.ts:32` — Haiku occasionally appended a sentence of commentary after the JSON. Now slices to the first balanced `{...}` before parsing.
- **End-to-end tailor cycle succeeded** for both qualified apps. Both routed to `quality_review` (not `ready`) due to (a) numerics gate firing on digit runs not in source `numbers[]`, (b) verbatim_phrase missing because no company artifacts are seeded. Resume PDFs rendered to `./tmp/resume-{app_id}.pdf` (~29KB each).
- **Quality gate calibration** is the next decision point — both gate failures are expected behavior, not bugs, but may be too strict for v1.
- **`agent/.env` is fully populated** (no longer placeholders); current-state.md updated.

## [2026-05-16] Karpathy-style wiki built; live-test scripts added; Run-Agent button shipped

- **Added wiki layer** at `docs/wiki/` following Karpathy's LLM Wiki pattern. Created `CLAUDE.md` at repo root as the schema. Populated index, log (this file), current-state, overview, architecture, data-model, decisions, gotchas, file-map, glossary, components/*, workflows/*.
- **Added local-runner scripts** (`scripts/run-harvestapi.ts`, `scripts/run-tailor.ts`) so the user can test end-to-end with their API dollars instead of waiting to deploy cloud routines. Commit `91d0029`.
- **Added "Run agent" button** to `/pipeline` page that spawns the Local Agent process via `POST /api/agent/run`. Commit `88db7dc`.
- **Installed Typst CLI locally** via `winget install Typst.Typst`. Verified end-to-end with the smoke test (`scripts/test-typst.ts` produces a 15KB PDF).
- **Created Chrome (Job Hunter) desktop shortcut.** Discovered that Chrome's security model requires `--remote-debugging-port` to be paired with a *dedicated* `--user-data-dir` (not the default Chrome profile). Updated `agent/scripts/setup-chrome-cdp.md` accordingly. Commit `c67c1e2`.
- **Pushed to GitHub** at https://github.com/farhan1188/hunter (new origin, set as default branch `main`).
- **Blocker:** `APIFY_API_TOKEN` is still missing from the root `.env` despite the user saying it was added. Cannot complete the first live ingest until that's there.

## [2026-05-14] v1 build sprint — Hub + Local Agent code-complete

- **Spec written** at `docs/superpowers/specs/2026-05-14-v1-application-pipeline-design.md`. Collapsed former Phase 2 (Tailoring) and Phase 3 (Auto-submit) into a single application-pipeline product. Atomic unit shifts from "job" to "application." Three discovery streams (existing adapters + Apify/HarvestAPI for LinkedIn + paste-URL). Two submission tiers (Tier 1 ATS auto-submit, Tier 2 Local Agent click-to-send). Six commits to the spec across the design conversation.
- **HarvestAPI Apify actor verified live** at apify.com/harvestapi/linkedin-job-search. 20-job test returned full JD text, accurate country codes, applyMethod URLs, and the unexpected goldmine field `applicantTrackingSystem` (used to auto-route Greenhouse/Lever/Ashby jobs to Tier 1). Test cost: $0.04. Projected monthly: $3-6, inside Apify's $5 free credit tier.
- **Two implementation plans written** at `docs/superpowers/plans/2026-05-14-v1-hub.md` (~50 tasks) and `docs/superpowers/plans/2026-05-14-v1-local-agent.md` (~12 tasks). TDD-formatted with full code blocks.
- **Plans executed via subagent-driven development.** ~30 subagent dispatches across the day. All ten stages of the Hub plan + all five stages of the Local Agent plan completed. 37 commits in total.
- **Stages 1-7 of Hub** = DB migrations 004/005, applications state machine + persist + query, Apify client + HarvestAPI ingestor, paste-URL flow, bullet selection + Typst rendering + cover letter + verbatim phrase + numerics check + claim-equivalence judge + gates orchestrator + Tailor routine prompt, Pipeline UI + detail page + 6 tabs, Dashboard, Settings dial + paused toggle + Apify token indicator, Q&A deny-list matcher + KB CRUD, Submit routine prompt (Greenhouse + Lever + Ashby) + cadence governor + caps.
- **Stages 8-9** = ATS coverage expansion + Outreach drafter (LinkedIn DM, draft-only).
- **Local Agent L1-L5** = `agent/` Node project, Chrome CDP connection, state bridge, four form fillers (shared / generic / LinkedIn Easy Apply / Workday), submit-runner, CLI entry point.
- **Aggregator adapters deferred** (Wellfound / Otta / BuiltIn) — the plan acknowledged they need real-site fixture capture and may be brittle. Skipped in favor of HarvestAPI which gives broad LinkedIn coverage.
- **Tests:** 65 passing across 26 files (root) + 2 in `agent/`. tsc clean on both. `npm run build` produces all 19 routes green.
- **Live testing not yet performed** — three cloud routines (`harvestapi`, `tailor`, `submit`) are written but not deployed via `/schedule` on claude.ai. Without them, no jobs flow in automatically.

## [2026-05-13] Phase 1 (Radar) shipped — user reported "too heavy" UI

- Pre-session-history entry summarizing what was built before the v1 pivot. Phase 1 = the "Job Radar" — see and rank, don't apply yet. 9 adapters, Turso DB, Haiku scorer, visa classifier, archetype filter, basic feed/profile/settings pages. Deployed and used. User feedback: "too heavy" — discovery without action isn't valuable. Triggered the v1 reframing on 2026-05-14.
