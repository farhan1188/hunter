# Job Hunter

Personal autonomous job-hunting system. Crawls global job sources every 2 hours,
ranks postings against your profile, and (in later phases) tailors applications
and submits them. Phase 1 is the **Job Radar** — see and rank, don't apply yet.

Built for a Pakistan-based candidate targeting roles globally (remote-international,
sponsorship-friendly EU/UK/US/Canada/UAE, etc.). All LLM work happens inside Claude
Code routines, covered by your Max subscription.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind, shadcn/ui) — the local Hub at `localhost:3000`
- **Turso (libSQL)** — canonical state, hosted SQLite
- **Claude Code `/schedule` routines** — Ingest (every 2h), Backup + Reconciler + Notifier (nightly)
- **Anthropic SDK** — one-shot resume extraction at upload (~$0.05 lifetime)
- **Google Drive** — nightly DB backups + resume PDF storage
- **Vitest** — tests
- **Playwright** (Phase 3) — local agent for auth-required submissions

## What's built

- **Stage A (Foundations):** Next.js scaffold, Turso client, migration runner, init schema, types + Zod schemas
- **Stage B (First slice):** RemoteOK adapter + ingest CLI + Hub feed page
- **Stage C (Profile + scoring):** resume upload, Sonnet extraction, Haiku scorer, profile page
- **Stage D (More adapters):** Honeypot, Greenhouse, visa+timezone classifier
- **Stage E (Hub):** filters, settings, source-health banner, "Run Now" trigger
- **Stage F (Routines):** Backup + Reconciler routine prompts (deploy via `/schedule`)
- **Stage G (Notifier):** daily Gmail digest routine
- **Stage H (Drive):** resume upload pushes to Drive + Turso pointer

## What you need to set up

1. **Install Turso CLI + provision DB** — see [`docs/setup.md`](docs/setup.md)
2. **Copy `.env.example` to `.env`** and fill in:
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_FULL`, `TURSO_AUTH_TOKEN_READ`
   - `ANTHROPIC_API_KEY`
   - (Optional for now) `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_DRIVE_FOLDER_ID`
3. **Apply migrations:** `npm run db:migrate`
4. **Deploy routines via `/schedule` in claude.ai** — copy each `routines/*.md` body:
   - `ingest.md` → cron `0 */2 * * *`
   - `backup.md` → cron `0 2 * * *`
   - `reconciler.md` → cron `0 3 * * *`
   - `notify-digest.md` → cron `0 3 * * *` (= 08:00 PKT)
5. After deploying, capture the API trigger URL + bearer and add to `.env` as
   `ANTHROPIC_API_TRIGGER_URL` + `ANTHROPIC_API_TRIGGER_TOKEN` (needed for the
   `Run Ingest now` button)
6. **Seed adapters in Turso** (one-time, until you do it via Settings page):
   ```bash
   turso db shell job-hunter "INSERT OR REPLACE INTO adapters (name, enabled, config_json) VALUES ('remoteok', 1, '{}')"
   turso db shell job-hunter "INSERT OR REPLACE INTO adapters (name, enabled, config_json) VALUES ('honeypot', 1, '{}')"
   turso db shell job-hunter "INSERT OR REPLACE INTO adapters (name, enabled, config_json) VALUES ('greenhouse', 1, '{\"tokens\":[\"gitlab\",\"automattic\",\"n26\"]}')"
   ```
7. **Run the Hub:** `npm run dev` → http://localhost:3000

## Day-to-day commands

```bash
npm run dev               # Hub at localhost:3000
npm test                  # all tests
npm run db:migrate        # apply any new migrations
npm run db:shell          # open Turso shell

npx tsx scripts/run-adapter.ts remoteok     # crawl one adapter locally (handy for testing)
npx tsx scripts/run-adapter.ts honeypot
npx tsx scripts/run-adapter.ts greenhouse
npx tsx scripts/annotate.ts                  # classify visa for any 'unknown' jobs
npx tsx scripts/score-feed.ts                # score any unscored jobs (uses your profile)
```

## Phase 1 verification

Once setup is complete:

1. Upload your resume on `/profile`; check that the extracted schema appears.
2. Fill in preferences.
3. Enable RemoteOK, Honeypot, Greenhouse on `/settings`.
4. Click **Run Ingest now** on `/feed`; refresh after 30–60s.
5. Confirm jobs show up with scores, sorted desc.
6. Test filters: `/feed?visa_category=international_remote`, `?country=de`, etc.

## Phase 2 / 3

Not yet implemented. See the spec for what's coming:
- **Phase 2:** Tailoring engine (per-job resume + cover letter) + LinkedIn outreach drafts
- **Phase 3:** Auto-submit (ATS-native), generic form filler, local agent

The implementation plan for Phase 1 is at `docs/superpowers/plans/2026-05-13-job-hunter-phase-1.md`.
The full design spec is at `C:\Users\user\.claude\plans\wondrous-rolling-fiddle.md`.

## Project shape

```
app/                  # Next.js routes (UI + API)
  api/{upload,preferences,settings,trigger}/
  feed/  profile/  settings/  inbox/  history/
components/           # shadcn/ui + site-nav
src/
  core/
    adapters/         # RemoteOK, Honeypot, Greenhouse (Phase 1)
    ingest/           # visa+timezone classifier
    jobs/             # persist, query
    scoring/          # Haiku LLM scorer
  db/                 # libSQL client + migrate runner + migrations/
  llm/                # Anthropic SDK wrapper
  profile/            # Sonnet extraction, store helpers
  lib/                # Drive client, notifier digest, heartbeat
routines/             # natural-language prompts for /schedule
  ingest.md  backup.md  reconciler.md  notify-digest.md
scripts/              # local CLIs (run-adapter, annotate, score-feed)
tests/                # smoke tests + fixtures
```
