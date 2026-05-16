# Hub UI

The Hub is a Next.js app (App Router) that serves as the user's daily interface to the pipeline. The default landing page is `/dashboard`; the primary action surface is `/pipeline`. UI components use shadcn/ui from `components/ui/`; shared layout wraps all pages from `app/layout.tsx`.

---

## Pages

### `/` — `app/page.tsx`

Redirects to `/dashboard`. No content of its own.

---

### `/dashboard` — `app/dashboard/page.tsx`

Server-rendered overview of pipeline health. No client-side charting library — plain HTML/CSS with text bars.

**Top strip (last 24h):**
- Jobs ingested
- Applications created
- Ready to send (current `state = 'ready'` count)
- Submitted today
- Needs review (current `state = 'quality_review'` count)

**Funnel:** table of current counts per state: `qualified → tailoring → quality_review → ready → submitted → submit_failed / closed / dismissed`.

**7-day trend:** 7-row table — date × jobs_ingested, applications_created, submitted.

**Routine health:** last run timestamp + status for ingest, tailor, submit, backup routines pulled from `routine_runs`.

---

### `/pipeline` — `app/pipeline/page.tsx`

Primary action surface. Four Kanban columns:

| Column | Criteria | User action |
|---|---|---|
| **Drafting** | `state IN ('qualified','tailoring')` | None — progress indicator only |
| **Needs review** | `state = 'quality_review'` | Review gate failures; accept or dismiss |
| **Ready** | `state = 'ready'` (non-auto-submit OR `channel = 'local_agent'`) | Click to send; open detail |
| **Recent** | `state IN ('submitted','submit_failed')` last 7d | Audit; retry failed |

Each card shows: company name, role, score, channel/vendor, age, primary action button.

**Paste-URL form** (`app/pipeline/paste-url-form.tsx`): text input on the Pipeline page. Submits to `POST /api/import-url`. On success, redirects to the new application's detail page; on score-below-threshold, shows a toast.

**Run Agent button** (`app/pipeline/run-agent-button.tsx`): triggers `POST /api/agent/run`. Spawns the Local Agent process. Returns when the agent exits, surfacing stdout + exit code.

---

### `/pipeline/[id]` — `app/pipeline/[id]/page.tsx`

Application detail. Header shows state, channel, submit_mode, and accept/dismiss buttons.

Six tabs (`app/pipeline/[id]/tabs.tsx`):

| Tab | Content |
|---|---|
| Cover letter | `applications.cover_letter_md` rendered as markdown |
| Resume PDF | Iframe preview of `resume_pdf_path` |
| Quality gates | Pass/fail badges per gate; `quality_gates_json.notes` |
| Q&A | Deny-list matches + KB answers; input to add new safe answers |
| JD | `jobs.description_md` rendered |
| Outreach | Draft LinkedIn DM button + draft text + Copy button |

When `state = 'ready' AND channel = 'local_agent'`: shows a "Mark as submitted" button (calls `POST /api/applications/[id]/review` with `action: 'mark_submitted'`).

---

### `/settings` — `app/settings/page.tsx`

Two sections:

1. **Global settings form** — `submission_paused` toggle (prominent at top), `cover_letter_max_words`, `quality_review_failure_mode`, `score_threshold`, `daily_cap`, `target_timezone`.
2. **Per-adapter table** — one row per registered adapter with dropdowns for `submit_mode` (`off / click_to_send / auto_submit`), `score_threshold` override, `daily_cap` override. Red banner when `submit_mode = 'auto_submit'` and `daily_cap = 0`.

---

### `/profile` — `app/profile/page.tsx`

Resume upload (PDF → structured extraction) and preference editing. Phase 1 surface, still active. Uploads go to `POST /api/upload`; preferences to `POST /api/preferences`.

---

### `/feed` — `app/feed/page.tsx`

Raw-input inspection from Phase 1. Shows all jobs from the `jobs` table regardless of qualification. Demoted from primary surface in v1 — linked from the Pipeline header as "View raw feed." Routine health banner lives here too (repurposed into the dashboard in v1).

---

### `/inbox`, `/history`

Phase 1 stubs. Not load-bearing in v1.

---

## API routes

| Method + Route | Purpose |
|---|---|
| `POST /api/import-url` | Paste-URL flow → `importJobFromUrl` |
| `POST /api/applications/[id]/review` | Actions: `accept`, `dismiss`, `mark_submitted` |
| `POST /api/applications/[id]/retry` | `submit_failed → ready` |
| `POST /api/applications/[id]/outreach` | Draft LinkedIn DM → `draftOutreach` |
| `GET /api/qa-kb` | List all KB entries |
| `POST /api/qa-kb` | Upsert a non-deny-list answer |
| `POST /api/settings` | Types: `settings` (global), `adapter` (field update), `adapter_upsert` (new row), `adapter_dial` (submit_mode/caps) |
| `POST /api/agent/run` | Spawn Local Agent via `child_process.spawn` |
| `POST /api/upload` | Phase 1 — resume PDF upload + extraction |
| `POST /api/preferences` | Phase 1 — save profile preferences |
| `POST /api/trigger` | Phase 1 — manual routine trigger |
| `POST /api/crawl` | Phase 1 — manual adapter crawl |
| `POST /api/score` | Phase 1 — manual scoring run |
| `POST /api/annotate` | Phase 1 — re-run visa classifier on unclassified jobs |
| `POST /api/reclassify` | Phase 1 — re-run archetype classifier |

---

## Shared components

- `components/ui/` — shadcn/ui primitives (Button, Card, Badge, Tabs, Dialog, etc.)
- `app/layout.tsx` — root layout with nav links to Dashboard / Pipeline / Feed / Settings / Profile
