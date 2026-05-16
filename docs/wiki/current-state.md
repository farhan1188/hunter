# Current state

**Last updated:** 2026-05-16

The "where are we right now" page. Updated whenever status changes. Read this before any work.

---

## Live / running

- **Turso DB** provisioned at https://app.turso.tech under user's account. All 5 migrations applied (001 init, 002 last_seen, 003 archetype, 004 application_pipeline, 005 qa_deny_list).
- **9 direct adapters** in code: RemoteOK, Honeypot, Greenhouse, Lever, Ashby, Himalayas, Jobicy, WorkingNomads, WeWorkRemotely. Whether they're currently *running* depends on whether the existing `ingest` cloud routine (from Phase 1) is still scheduled — unconfirmed in this session.
- **GitHub remote** at https://github.com/farhan1188/hunter. Default branch `main`. All session work pushed.
- **Job Hunter Chrome** running locally with CDP on port 9222, dedicated profile at `C:\Users\user\chrome-cdp-profile`, LinkedIn signed in. Stays open while user uses the Local Agent.
- **Typst CLI** installed locally (v0.14.2). PDF rendering works end-to-end.

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

- **First end-to-end live test** blocked on `APIFY_API_TOKEN` not being in root `.env`. User said they added it but `grep -c '^APIFY_API_TOKEN=' .env` returned 0. Need to verify token is present before `npm run ingest:linkedin` can succeed.
- **`agent/.env` Turso fields** are placeholders. User needs to copy `TURSO_DATABASE_URL` from root `.env` and either copy `TURSO_AUTH_TOKEN_FULL` as `TURSO_AUTH_TOKEN_AGENT` or generate a scoped token. Until then, agent can't read the DB.

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

1. Confirm `APIFY_API_TOKEN` is in root `.env`. If missing, paste it.
2. Fill `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN_AGENT` in `agent/.env`.
3. Run `npm run ingest:linkedin -- --rows=5` (Claude can do this once env is set).
4. Run `npm run tailor`.
5. Open `/pipeline`, eyeball whatever ended up in Ready / Needs review.
6. Click into 2-3 cards in `/pipeline/[id]`, read the cover letters.
7. If quality is acceptable, proceed to deploying the 3 routines via `/schedule`.
8. Otherwise, course-correct prompts and re-run locally first.
