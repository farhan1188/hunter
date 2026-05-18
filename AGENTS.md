# AGENTS.md — Schema for the Job Hunter knowledge base

This file is the **schema** for the project's LLM-maintained wiki. It tells you (Codex, or any LLM agent) how the repo is laid out, how knowledge is organized, and what conventions to follow when you work here. The wiki pattern is Karpathy's LLM Wiki: three layers — raw sources (immutable), wiki (LLM-maintained), schema (this file).

> **Always read `docs/wiki/index.md` at session start.** That's the catalog of everything. Drill into specific pages from there. Do not read all wiki files blindly — context is finite. The index is designed so you can decide what's relevant before reading.

---

## Project at a glance

**What:** A personal autonomous job-hunting platform for a Pakistan-based senior dev hunting global remote roles (US/UK/EU/CA/AE/SG). Discovers LinkedIn + 9 other job sources, scores against the user's profile, tailors per-job resume + cover letter, auto-submits to Greenhouse/Lever/Ashby, click-to-send everywhere else via a Local Agent that uses the user's authenticated Chrome.

**Status:** v1 application-pipeline code-complete (37+ commits this session). Production build green. Local Agent + Hub work end-to-end. **Not yet running automatically** — the three cron routines (`harvestapi`, `tailor`, `submit`) are written but not deployed via `/schedule` on Codex.ai.

**See:** `docs/wiki/current-state.md` for the exact "what works, what's blocked, what's deferred" snapshot.

---

## The three layers

### Layer 1 — Raw sources (immutable)

Treat these as ground truth. Never edit them retroactively; they're the historical record of what was decided when.

| Location | What's there |
|---|---|
| `docs/superpowers/specs/2026-05-14-v1-application-pipeline-design.md` | The v1 spec. Architecture, state machine, components, build order. Read this when you need to understand WHY something is designed the way it is. |
| `docs/superpowers/plans/2026-05-14-v1-hub.md` | Hub implementation plan. ~50 tasks with code blocks. The wiki summarizes; this is the source. |
| `docs/superpowers/plans/2026-05-14-v1-local-agent.md` | Local Agent plan. ~12 tasks. |
| `docs/superpowers/plans/2026-05-13-job-hunter-phase-1.md` | The original Phase 1 (Radar) plan, pre-pivot to application-first. Historical context. |
| `docs/setup.md` | Turso provisioning instructions. |
| `docs/turso-tokens.md` | Scoped-token strategy per routine. |
| `README.md` | High-level entry point, kept short. |

### Layer 2 — Wiki (LLM-maintained)

Lives at `docs/wiki/`. You own this layer. Update pages when behavior or design changes; append to `log.md` after every meaningful session.

| File | Purpose |
|---|---|
| `index.md` | Catalog of all wiki pages with one-line summaries. **Read first.** |
| `log.md` | Append-only chronological record of session work. Format: `## [YYYY-MM-DD] <topic> — <one-line summary>`. |
| `overview.md` | Project goal, user profile, why this exists. |
| `current-state.md` | What's shipped, what's deferred, what's blocked, who acts next. Updated continuously. |
| `architecture.md` | The system as a whole: Hub + routines + Local Agent + Apify, how they connect. |
| `data-model.md` | Turso schema, application state machine, key invariants. |
| `decisions.md` | Architecture Decision Records. Why we chose Apify over Bright Data, why state machine has these edges, why outreach is draft-only forever, etc. |
| `gotchas.md` | Non-obvious pitfalls and their fixes. libSQL `SELECT *` bug, PowerShell call operator, Chrome CDP requires dedicated profile, etc. |
| `file-map.md` | What lives where in `src/`, `app/`, `agent/`, `routines/`. Annotated. |
| `glossary.md` | Project-specific terms (Tier 1 vs Tier 2, archetype, verbatim phrase, quality gates, etc). |
| `open-questions.md` | Known unknowns and things to revisit. |
| `components/*.md` | One page per subsystem (discovery, tailoring, submission, quality-gates, qa-kb, outreach, ui). |
| `workflows/*.md` | Step-by-step procedures for common tasks (setup, daily loop, adding adapters, deploying routines). |

### Layer 3 — Schema (this file)

You're reading it. Updates when the wiki conventions themselves change. Don't accumulate substance here; substance goes in the wiki.

---

## Operating rules

### When you start a session

1. Read `docs/wiki/index.md` to orient. ~2 minutes of reading.
2. Skim `docs/wiki/log.md` for the last 1-3 entries — what happened recently.
3. Read `docs/wiki/current-state.md` — what's the actual state of the system right now.
4. Only then drill into specific pages as the task demands.

### When you finish a meaningful unit of work

1. Append an entry to `docs/wiki/log.md` in the format above.
2. Update `docs/wiki/current-state.md` if status changed.
3. If you discovered a non-obvious pitfall, add to `docs/wiki/gotchas.md`.
4. If you made a load-bearing decision, add an ADR to `docs/wiki/decisions.md`.
5. If wiki structure changed, update `docs/wiki/index.md`.

### When you write a new wiki page

- Front-load the most important sentence in the first paragraph. Future readers may not scroll.
- Use tables and bullet lists over prose where possible.
- Link to related pages with relative links: `[discovery](components/discovery.md)`.
- If the page documents code, reference exact paths: `src/core/tailor/typst-render.ts:42`.
- Date stamps in headers: `## [2026-05-16]`.
- Default to American English. Default to lowercase code identifiers (`submit_mode`, not `SubmitMode`).

### When you make a decision worth remembering

Add to `docs/wiki/decisions.md` using ADR-lite format:

```markdown
## ADR-NN: <one-line decision>
**Date:** YYYY-MM-DD
**Status:** accepted | superseded by ADR-MM
**Context:** what problem are we solving
**Decision:** what we're going to do
**Why:** the reasoning, including alternatives considered
**Consequences:** what this enables, what it forecloses
```

### When you find a pitfall

Add to `docs/wiki/gotchas.md`:

```markdown
## <one-line symptom>
**You'll see:** the error message or weird behavior.
**Cause:** what's actually wrong.
**Fix:** the specific resolution.
**Why it's tricky:** what made it non-obvious.
```

### When the platform's state changes

Update `docs/wiki/current-state.md`. This is the most heavily-read page; keep it accurate. Use these sections:
- **Live / running** — what's actually working in production
- **Code-complete / not yet deployed** — built but waiting for user action to ship
- **Deferred** — explicitly chosen to skip; usually with a reason
- **Blocked** — needs something specific (user action, external dependency)
- **Open questions** — link to `open-questions.md`

---

## Code conventions

Captured separately at `docs/wiki/conventions.md` (TS style, commit message format, import paths, etc.). Updated when a pattern changes.

Key things every session must know:
- **TypeScript path alias** `@/` → project root. Agent's alias `@hub/` → `../src/`.
- **Commit style** `feat(area): description` / `fix(area): description` / `docs(area): description` / `chore(area): description`. No co-author footer.
- **Test runner** `npm test` (vitest run). Focus with `npm test -- <pattern>`.
- **Migrations** `npm run db:migrate`. SQL files in `src/db/migrations/NNN_*.sql`. Idempotent — already-applied migrations skip.
- **libSQL footgun** Always list columns explicitly in `SELECT`; `SELECT *` returns wrong values via HTTP client. See `docs/wiki/gotchas.md`.

---

## What lives outside the wiki

Things that are NOT in the wiki and should not be duplicated there:

- **Code** — `src/`, `app/`, `agent/`. The wiki references but doesn't paraphrase.
- **Routine prompts** — `routines/*.md`. These are written for the Anthropic /schedule runtime, not for humans.
- **Secrets** — `.env`, `agent/.env`. Never readable by Codex; never echoed in chat or commits.
- **User-level auto-memory** — `~/.Codex/projects/.../memory/`. That's Codex's cross-session memory; the project wiki is separate.
- **Build artifacts** — `.next/`, `node_modules/`, `dist/`, `tmp/`, `*.pdf`.

---

## What this wiki is NOT for

- **Tutorials.** External docs (Next.js, Playwright, Apify) live on their own sites. We link, we don't reproduce.
- **Auto-generated API reference.** Code is the source of truth for function signatures.
- **Stream-of-consciousness notes.** Every wiki page is structured; freeform thinking goes in commits, PR descriptions, or the session log.

---

## Health check before committing wiki changes

- [ ] Did I update `index.md` if I added or removed a page?
- [ ] Did I add a `log.md` entry?
- [ ] Are all internal links relative and correct?
- [ ] Does `current-state.md` reflect reality?
- [ ] If I changed code, did I update the relevant `components/*.md` page?
