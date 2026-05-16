# Wiki index

Catalog of every page in `docs/wiki/`. **Read this first** when entering a session. Each entry has the page name + a one-line "what's in it" so you can decide what to drill into.

> Convention: when you add a wiki page, register it here in the right section, with a one-line summary. When you remove a page, delete the entry.

---

## Start-of-session reading order

1. **[overview.md](overview.md)** — what the project is and who the user is. Skip if you've worked here before.
2. **[current-state.md](current-state.md)** — what's running, what's blocked, who acts next. Always reread; this changes.
3. **[log.md](log.md)** — the last few session entries. Tells you what just happened.

That's it for orientation. Then drill in based on the task.

---

## Core pages

| Page | One-liner |
|---|---|
| [overview.md](overview.md) | Project goal, user, why this exists. |
| [current-state.md](current-state.md) | What's shipped / blocked / deferred right now. The "where are we" page. |
| [log.md](log.md) | Append-only session log. Last entries are most relevant. |
| [architecture.md](architecture.md) | System diagram: Hub + cloud routines + Local Agent + Apify, how they connect. |
| [data-model.md](data-model.md) | Turso schema (every table, every column) + application state machine + invariants. |
| [decisions.md](decisions.md) | ADRs — why we picked Apify over Bright Data, why outreach is draft-only, etc. |
| [gotchas.md](gotchas.md) | Non-obvious pitfalls and their fixes. libSQL `SELECT *`, Chrome CDP profile rule, PowerShell `&`, etc. |
| [file-map.md](file-map.md) | What lives where in `src/`, `app/`, `agent/`, `routines/`. |
| [glossary.md](glossary.md) | Project-specific terms (Tier 1/Tier 2, archetype, verbatim phrase, etc). |
| [open-questions.md](open-questions.md) | Known unknowns. Things to revisit. |
| [conventions.md](conventions.md) | Code style, commit format, test runner, import aliases. |

---

## Components (one page per subsystem)

| Page | One-liner |
|---|---|
| [components/discovery.md](components/discovery.md) | How jobs enter the system: 9 direct adapters + Apify/HarvestAPI for LinkedIn + paste-URL. |
| [components/tailoring.md](components/tailoring.md) | Per-job resume PDF (Typst) + cover letter (Haiku) + verbatim phrase fetch. |
| [components/quality-gates.md](components/quality-gates.md) | Numerics + claim-equivalence + verbatim-phrase. How each works, what triggers failure. |
| [components/submission.md](components/submission.md) | Tier 1 (ATS auto-submit) + Tier 2 (Local Agent click-to-send). Cadence governor, caps, deny-list. |
| [components/qa-kb.md](components/qa-kb.md) | The Q&A Knowledge Base + hardcoded deny-list (visa/EEO/salary halts). |
| [components/outreach.md](components/outreach.md) | LinkedIn DM drafter. Draft-only forever; never auto-sends. |
| [components/ui.md](components/ui.md) | All Hub pages: `/dashboard`, `/pipeline`, `/pipeline/[id]`, `/settings`, `/feed`. |
| [components/local-agent.md](components/local-agent.md) | The `agent/` Node project: CDP connection, form fillers, runner CLI. |

---

## Workflows (how-to procedures)

| Page | One-liner |
|---|---|
| [workflows/setup-from-scratch.md](workflows/setup-from-scratch.md) | Fresh install — clone repo, install deps, provision Turso, fill `.env`, deploy routines. |
| [workflows/daily-loop.md](workflows/daily-loop.md) | What a normal day looks like once the system is live. |
| [workflows/deploy-routines.md](workflows/deploy-routines.md) | How to deploy `harvestapi`, `tailor`, `submit` via `/schedule` on claude.ai. |
| [workflows/run-local-agent.md](workflows/run-local-agent.md) | Setting up the Chrome shortcut and running `npm run agent`. |
| [workflows/add-an-adapter.md](workflows/add-an-adapter.md) | Pattern for adding a new job-source adapter. |
| [workflows/local-test-cycle.md](workflows/local-test-cycle.md) | Using `npm run ingest:linkedin` + `npm run tailor` to test end-to-end with API dollars instead of cloud routines. |
| [workflows/extend-state-machine.md](workflows/extend-state-machine.md) | Adding a new application state or transition without breaking invariants. |
| [workflows/tune-quality-gates.md](workflows/tune-quality-gates.md) | Adjusting prompts/thresholds after spot-checking submissions. |

---

## Where the raw source layer lives (outside the wiki)

The Karpathy pattern keeps "raw sources" separate from the wiki. These are immutable historical documents the wiki summarizes. Do not edit retroactively.

| Location | What's there |
|---|---|
| `docs/superpowers/specs/2026-05-14-v1-application-pipeline-design.md` | v1 spec (canonical) |
| `docs/superpowers/plans/2026-05-14-v1-hub.md` | Hub implementation plan |
| `docs/superpowers/plans/2026-05-14-v1-local-agent.md` | Local Agent plan |
| `docs/superpowers/plans/2026-05-13-job-hunter-phase-1.md` | Phase 1 plan (historical, pre-pivot) |
| `docs/setup.md` | Turso provisioning |
| `docs/turso-tokens.md` | Scoped tokens per routine |
| `README.md` | High-level entry point |
| `CLAUDE.md` (root) | The schema for this whole system |

---

## Index hygiene

If a wiki page exists on disk but isn't listed here, it's invisible. If a page is listed here but doesn't exist on disk, future sessions chase a dead link. **Audit on every significant change.**
