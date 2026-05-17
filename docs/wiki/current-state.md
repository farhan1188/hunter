# Current state

**Last updated:** 2026-05-16 (post first live ingest+tailor cycle)

The "where are we right now" page. Updated whenever status changes. Read this before any work.

---

## Live / running

- **Turso DB** provisioned at https://app.turso.tech under user's account. All 5 migrations applied (001 init, 002 last_seen, 003 archetype, 004 application_pipeline, 005 qa_deny_list).
- **9 direct adapters** in code: RemoteOK, Honeypot, Greenhouse, Lever, Ashby, Himalayas, Jobicy, WorkingNomads, WeWorkRemotely. Whether they're currently *running* depends on whether the existing `ingest` cloud routine (from Phase 1) is still scheduled — unconfirmed in this session.
- **GitHub remote** at https://github.com/farhan1188/hunter. Default branch `main`. All session work pushed.
- **Job Hunter Chrome** running locally with CDP on port 9222, dedicated profile at `C:\Users\user\chrome-cdp-profile`, LinkedIn signed in. Stays open while user uses the Local Agent.
- **Typst CLI** installed locally (v0.14.2) at `…\WinGet\Packages\Typst.Typst_…\typst-x86_64-pc-windows-msvc\typst.exe`. Not on PATH; `TYPST_BIN` env var (root `.env`) points the renderer at it. PDF rendering works end-to-end (~29KB per resume).
- **First live ingest+tailor cycle** done (2026-05-16). 9 jobs ingested via Apify; 2 qualified at scores 92 (Zillow Senior PM Data Platform) and 82 (Gogo AI PM); both rendered to PDF; both routed to `quality_review` due to strict gate calibration (see Open questions).

## Code-complete, not yet deployed (needs user action)

These are written and tested but won't *do* anything until deployed:

- **`routines/harvestapi.md`** — pulls LinkedIn jobs via Apify daily. Needs `/schedule` deploy at cron `0 6 * * *`.
- **`routines/tailor.md`** — produces tailored resume + cover letter every 30 min. Needs `/schedule` deploy at cron `*/30 * * * *`.
- **`routines/submit.md`** — auto-submits to Greenhouse/Lever/Ashby every 15 min. Needs `/schedule` deploy at cron `*/15 * * * *`. **Keep `submission_paused = ON` until first 5-10 manual reviews look good.**
- **Aggregator adapters** (Wellfound, Otta, BuiltIn) — deferred per the plan. Add only if HarvestAPI coverage feels thin.

## Workable locally (no cloud deploy needed for testing)

- **`npm run dev`** → http://localhost:3000 → land on `/dashboard`. Hub works for browsing the DB.
- **`npm run ingest:linkedin -- --rows=N`** → local-runner equivalent of harvestapi routine. Uses `APIFY_API_TOKEN` + `ANTHROPIC_API_KEY` from root `.env`. Costs ~$0.05 per 5 jobs.
- **`npm run tailor`** → local-runner equivalent of tailor routine. Processes up to 5 qualified applications per invocation. Writes PDFs to `./tmp/`.
- **`npm run agent`** → Local Agent picks one ready application, opens it in Job Hunter Chrome, fills form, stops at Submit.
- **"Run agent" button on `/pipeline`** → same thing as `npm run agent`, triggered from the UI.

## Blocked

- Nothing currently blocked. `APIFY_API_TOKEN` is now in `.env`; `agent/.env` is fully populated (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_AGENT`, `CHROME_CDP_URL`). Decision needed on quality-gate calibration before next ingest.

## Deferred (intentional)

- **Workday SSO automation** — Local Agent halts on Workday SSO; user signs in once in Job Hunter Chrome and re-runs. Cleaner than reimplementing SSO flows.
- **LinkedIn DM auto-paste** — draft-only forever per architecture decision. User copy-pastes manually.
- **Hunt-outcome analytics** (responses, interviews, offers tracking) — deferred until ≥50 submissions exist.
- **Per-archetype autonomy dials** — per-source dial is sufficient.
- **In-browser LinkedIn scraping by the Local Agent** — Apify handles LinkedIn discovery entirely; agent never touches LinkedIn for discovery. Only touches it for Easy Apply submission.
- **Local Agent Saved-Jobs ingester** — was in the original Local Agent plan, dropped once Apify replaced its discovery role.

## Open questions

See [open-questions.md](open-questions.md). Highlights:
- Will HarvestAPI's free $5/month credit cover steady-state volume? (Projected yes; measure to confirm.)
- Will the Tailor routine's claim-equivalence judge flag too aggressively? (Unknown until live data.)
- Does the Submit routine handle Greenhouse forms with custom questions reliably? (Untested in production.)

## What "user acts next" looks like

Right now, in priority order:

1. Open `http://localhost:3000/pipeline` (dev server should be running). Look at the two `quality_review` cards (Zillow Senior PM Data Platform, Gogo AI PM). Open `tmp/resume-*.pdf` to eyeball the rendered resumes; read the cover letters in the detail page.
2. Decide on quality-gate calibration:
   - Should the numerics gate flag every digit run not in source `numbers[]`, or should it allow company/role names containing digits?
   - Should verbatim_phrase be a soft warning instead of a hard fail when no company artifact is fetchable?
3. After gate decision: run `npm run ingest:linkedin -- --rows=5 --titles=3 --locations=3` for a bigger sample (~$0.45).
4. After 5-10 manual reviews look good: deploy the 3 routines via `/schedule` on claude.ai per [workflows/deploy-routines.md](workflows/deploy-routines.md). Keep `submission_paused = ON` initially.
