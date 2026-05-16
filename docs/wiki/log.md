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
