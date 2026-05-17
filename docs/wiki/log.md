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
