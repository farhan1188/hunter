# Architecture

Job Hunter is three runtimes sharing one database. The Hub serves the UI and triggers work; cloud routines run on Anthropic infrastructure on a cron schedule; the Local Agent runs on the user's machine and drives Chrome via CDP for Tier 2 submissions. All three talk to the same Turso (hosted libSQL) instance.

Related: [data-model](data-model.md) | [decisions](decisions.md) | [file-map](file-map.md)

---

## System diagram

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Apify cloud (third-party)                                              │
  │  Actor: harvestapi/linkedin-job-search (id: zn01OAlzP853oqn4Z)        │
  └───────────────────────────┬─────────────────────────────────────────────┘
                              │ run-sync-get-dataset-items (HTTP POST)
                              ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Cloud routine: harvestapi  (Anthropic /schedule, cron 0 6 * * *)     │
  │  Scores jobs → creates applications rows (state = qualified)           │
  └───────────────────────────┬─────────────────────────────────────────────┘
                              │ writes to Turso
                              ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      Turso (canonical state)                           │
  │   jobs / scores / applications / profile / settings / qa_kb /         │
  │   adapters / outreach_drafts / routine_runs                            │
  └──────────┬──────────────────────────────┬──────────────────────────────┘
             │ reads qualified              │ reads ready (ats_native)
             ▼                             ▼
  ┌──────────────────────┐    ┌───────────────────────────────────────────┐
  │  Cloud routine:      │    │  Cloud routine: submit                    │
  │  tailor              │    │  (cron */15 * * * *)                      │
  │  (cron */30 * * * *) │    │  Tier 1 only: Greenhouse/Lever/Ashby     │
  │  PDF + cover letter  │    │  Uses Playwright MCP on Anthropic infra  │
  │  → ready or          │    │  → submitted (or submit_failed)          │
  │    quality_review    │    └───────────────────────────────────────────┘
  └──────────────────────┘
                              ┌─────────────────────────────────────────────┐
                              │  Hub (Next.js, localhost:3000)              │
                              │  Reads Turso for all UI pages               │
                              │  POST /api/agent/run → spawns Local Agent  │
                              └──────────────┬──────────────────────────────┘
                                             │ child_process.spawn
                                             ▼
                              ┌─────────────────────────────────────────────┐
                              │  Local Agent (Node ESM CLI, agent/)         │
                              │  Reads Turso for ready (local_agent) apps   │
                              │  Connects to Chrome via CDP (port 9222)     │
                              │  Fills form → stops before Submit           │
                              │  User clicks Submit manually                │
                              └─────────────────────────────────────────────┘

  Other cloud routines (all on Anthropic /schedule):
    backup        nightly 02:00 UTC  — dumps Turso, uploads to Drive
    reconciler    nightly 03:00 UTC  — orphan cleanup + adapter revival
    notify-digest 08:00 Asia/Karachi — daily digest email via Gmail MCP
```

---

## Data flow: end to end

```
Apify
  └─► jobs table (INSERT OR IGNORE)
        └─► scores table (Haiku)
              └─► applications (state=qualified)
                    └─► tailor routine
                          ├─► resume PDF (Typst) → Google Drive
                          ├─► cover letter (Haiku)
                          ├─► quality gates (numerics + claim_equiv + verbatim_phrase)
                          ├─► state=ready, channel=ats_native  →  submit routine → state=submitted
                          └─► state=ready, channel=local_agent → Local Agent → user clicks Submit
```

---

## Per-runtime responsibilities

### Hub (Next.js, `localhost:3000`)

The Hub is a local-only web app. It never runs on Vercel; it only runs while the user has `npm run dev` running. See [components/ui](components/ui.md).

| Responsibility | Where |
|---|---|
| Pipeline Kanban UI (`/pipeline`) | `app/pipeline/page.tsx` |
| Application detail (`/pipeline/[id]`) | `app/pipeline/[id]/page.tsx` |
| Dashboard stats (`/dashboard`) | `app/dashboard/page.tsx` |
| Feed (raw job list) (`/feed`) | `app/feed/page.tsx` |
| Settings / adapter dials (`/settings`) | `app/settings/page.tsx` |
| Profile upload + preferences (`/profile`) | `app/profile/page.tsx` |
| Paste-URL ingest | `app/api/import-url/route.ts` |
| One-shot crawl trigger | `app/api/crawl/route.ts` |
| Q&A KB management | `app/api/qa-kb/route.ts` |
| Agent trigger ("Run agent" button) | `app/api/agent/run/route.ts` |
| Outreach draft creation | `app/api/applications/[id]/outreach/route.ts` |
| Settings read/write | `app/api/settings/route.ts` |

Hub LLM calls (paste-URL scoring, profile extraction) use `getAnthropic()` from `src/llm/client.ts` with `ANTHROPIC_API_KEY` from root `.env`.

### Cloud routines (Anthropic `/schedule`)

Natural-language markdown prompts in `routines/*.md`. The Anthropic runtime reads the prompt and executes the steps using its built-in tools (Turso HTTP API, Playwright MCP, Gmail MCP, Drive access). **Routine code has no access to `getDb()` or any TypeScript imports from this repo** — it reads the prompt and issues raw HTTP/SQL calls.

| Routine | File | Cron | Purpose |
|---|---|---|---|
| `harvestapi` | `routines/harvestapi.md` | `0 6 * * *` | LinkedIn discovery via Apify |
| `tailor` | `routines/tailor.md` | `*/30 * * * *` | Resume PDF + cover letter + quality gates |
| `submit` | `routines/submit.md` | `*/15 * * * *` | Tier 1 auto-submit (Greenhouse/Lever/Ashby) |
| `backup` | `routines/backup.md` | nightly 02:00 UTC | DB dump → Drive |
| `reconciler` | `routines/reconciler.md` | nightly 03:00 UTC | Orphan cleanup + adapter revival |
| `notify-digest` | `routines/notify-digest.md` | 08:00 Asia/Karachi | Daily digest email |
| `ingest` | `routines/ingest.md` | (Phase 1 holdover) | Direct adapter crawl (9 non-LinkedIn sources) |

Each routine uses a **scoped Turso token** with the minimum permissions needed (see `docs/turso-tokens.md`).

### Local Agent (`agent/`)

A Node ESM project. Launched by Hub via `child_process.spawn` or directly with `npm run agent` in `agent/`. See [components/local-agent](components/local-agent.md).

| Responsibility | Where |
|---|---|
| Connect to Chrome via CDP | `agent/src/chrome.ts` |
| Read next ready application from Turso | `agent/src/state.ts` |
| Route to form filler by URL pattern | `agent/src/submit-runner.ts` |
| Generic form filler | `agent/src/form-fillers/generic.ts` |
| LinkedIn Easy Apply filler | `agent/src/form-fillers/linkedin-easyapply.ts` |
| Workday filler | `agent/src/form-fillers/workday.ts` |
| Config (env, CDP URL) | `agent/src/config.ts` |
| Entry point | `agent/src/index.ts` |

The agent **stops before clicking Submit**. The user reviews the filled form in Chrome and submits manually. They then mark it submitted in the Hub UI.

---

## External dependencies

| Dependency | What for | Cost / notes |
|---|---|---|
| **Apify** (`apify.com`) | LinkedIn job scraping (no-cookies actor) | ~$1/1k results; fits in $5/mo free tier at our volume |
| **Anthropic API** | Hub-side LLM (profile extract, paste-URL score); also powers cloud routines via `/schedule` | Hub calls billed to `ANTHROPIC_API_KEY`; routines run under Claude Code Max subscription |
| **Turso** (`app.turso.tech`) | Canonical state — all tables | Free tier; accessed via `@libsql/client` over HTTP |
| **Google Drive** | Resume PDF storage (uploaded by Tailor routine); nightly DB dump backups | Via service account (`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`) |
| **Google Gmail** (MCP) | Daily digest emails from `notify-digest` routine | Via Gmail MCP in routine environment |
| **Typst CLI** | Render tailored resume to PDF | Must be on PATH; v0.14.2 confirmed working |
| **Chrome** (user's browser) | Authenticated form filling (Tier 2 submissions) | Dedicated profile at `C:\Users\<you>\chrome-cdp-profile` |

---

## Why this split, not a monolith

Three relevant ADRs:

- **ADR-001** — Turso chosen over local SQLite + tunnel because cloud routines run on Anthropic infrastructure, not the user's laptop. A local DB would be unreachable from cloud routines.
- **ADR-006** — Tier 1 vs Tier 2 split. Auto-submit is safe only for standardized ATS forms (Greenhouse/Lever/Ashby). Generic forms are routed to Local Agent + manual click to avoid bad submissions.
- **ADR-008 / ADR-009** — LinkedIn discovery moved to Apify to avoid account risk; Local Agent is submit-only as a consequence.

The Hub is local-only (not Vercel) because the "Run agent" button spawns a child process — that only works when Hub and agent are on the same machine (ADR-012).

---

## Turso token strategy

Each runtime gets its own scoped token:

| Runtime / routine | Token env var | Permissions |
|---|---|---|
| Hub | `TURSO_AUTH_TOKEN_FULL` | read + write (all tables) |
| `harvestapi` routine | `TURSO_AUTH_TOKEN_HARVESTAPI` | write to jobs, applications; read profile/settings |
| `tailor` routine | `TURSO_AUTH_TOKEN_TAILOR` | read+write applications; read jobs, profile; write routine_runs |
| `submit` routine | `TURSO_AUTH_TOKEN_SUBMIT` | read+write applications; read jobs, adapters, qa_kb; write adapters, routine_runs |
| `backup` | `TURSO_AUTH_TOKEN_BACKUP` | read-only |
| `reconciler` | `TURSO_AUTH_TOKEN_RECONCILER` | read+write adapters, routine_runs; read applications |
| `notify-digest` | `TURSO_AUTH_TOKEN_READ` | read-only |
| Local Agent | `TURSO_AUTH_TOKEN_AGENT` | read applications + jobs; write applications (state updates) |

See `docs/turso-tokens.md` for provisioning steps.
