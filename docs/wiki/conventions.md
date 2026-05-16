# Conventions

Code style, commit format, naming, and operational rules. Concrete and short. When a pattern changes, update this page.

Related: [file-map](file-map.md) | [gotchas](gotchas.md)

---

## Commit message format

```
<type>(<area>): <subject>
```

**Types:** `feat` / `fix` / `docs` / `chore` / `test` / `refactor`

**Area:** the module or subsystem affected. Examples: `applications`, `tailor`, `submit`, `agent`, `ui`, `db`, `wiki`.

**Rules:**
- Subject is imperative mood, lowercase, no trailing period.
- No co-author footer (project preference).
- Keep subject under 72 characters.

Examples from this repo:
```
feat(applications): pipeline + detail + dashboard queries
fix(types): Application/OutreachDraft + JobPosting.apply_url/ats_vendor
docs(turso): scoped token requirements for Tailor/Submit/HarvestAPI
chore(deps): add @libsql/client
```

---

## TypeScript path aliases

| Alias | Resolves to | Used in |
|---|---|---|
| `@/` | repo root | all root project files (`src/`, `app/`, `tests/`) |
| `@hub/` | `../src/` (relative to `agent/`) | `agent/src/` files that import shared logic |

Examples:
```typescript
// Root project — cross-module import
import { getDb } from "@/src/db/client";

// Agent — importing Hub code
import { matchesDenyList } from "@hub/core/qa/deny-list";
```

Aliases are declared in both `tsconfig.json` (root) and `agent/tsconfig.json`, and mirrored in `vitest.config.ts`.

---

## Imports

- **Relative imports** (`./`, `../`) for files within the same module directory (e.g. within `src/core/tailor/`).
- **Alias imports** (`@/`, `@hub/`) for cross-module imports.
- Never use bare `src/` paths without an alias prefix.

---

## ESM vs CJS

| Project | Module system | Note |
|---|---|---|
| Root (`src/`, `app/`) | Handled by Next.js bundler | No `"type": "module"` in root `package.json` |
| `agent/` | ESM (`"type": "module"`) | All files are ES modules |

**ESM import extension rule** — In `agent/src/`, imports must use `.js` extensions even though the source files are `.ts`:
```typescript
// agent/src/index.ts — CORRECT
import { loadConfig } from "./config.js";

// WRONG (TypeScript resolves this but Node ESM doesn't)
import { loadConfig } from "./config";
```
This is standard Node ESM convention. TypeScript understands `.js` → `.ts` remapping at compile time.

---

## Naming

| Thing | Convention | Example |
|---|---|---|
| SQL columns | `snake_case` | `ats_vendor`, `created_at`, `daily_cap` |
| TypeScript variables | `camelCase` | `atsVendor`, `createdAt`, `dailyCap` |
| TypeScript types / interfaces | `PascalCase` | `ApplicationState`, `JobPosting`, `QualityGates` |
| React components | `PascalCase` | `PipelinePage`, `RunAgentButton` |
| Enum-like union literals | `snake_case` strings | `"ats_native"`, `"quality_review"`, `"click_to_send"` |
| Adapter names | `snake_case` matching DB | `"remoteok"`, `"weworkremotely"`, `"linkedin"` |
| Migration files | `NNN_descriptive_name.sql` | `004_application_pipeline.sql` |

---

## Tests

- **Runner:** Vitest. Run: `npm test`. Focus: `npm test -- <pattern>` (e.g. `npm test -- cadence`).
- **File location:** `tests/**/*.test.ts`. Mirrors source structure: `tests/tailor/bullet-selection.test.ts` tests `src/core/tailor/bullet-selection.ts`.
- **LLM mocking:** Mock at module level with `vi.mock`:
  ```typescript
  vi.mock("@/src/llm/client", () => ({
    getAnthropic: () => ({ messages: { create: mockCreate } }),
    MODEL_HAIKU: "claude-haiku-4-5",
  }));
  ```
- **JSON fixture types:** Cast imported JSON fixtures to avoid union-literal widening (see [gotchas](gotchas.md)):
  ```typescript
  const fixture = raw as unknown as HarvestApiItem[];
  ```
- **`vi.fn` typed mocks:** Provide function signature to get typed `mock.calls`:
  ```typescript
  const mockFetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
  ```

---

## DB calls

- **Always** use `db.execute({ sql, args })` with named args. Never string interpolation.
- **Never** use `SELECT *`. List columns explicitly. Every time. This is enforced by convention only — there is no linter. See [gotchas](gotchas.md).
- Template to follow: `src/core/applications/query.ts`.

```typescript
// CORRECT
const { rows } = await db.execute({
  sql: "SELECT id, state, channel, ats_vendor FROM applications WHERE id = ?",
  args: [applicationId],
});

// WRONG — silently returns garbage column values
const { rows } = await db.execute("SELECT * FROM applications WHERE id = ?");
```

---

## Time

| Context | Convention |
|---|---|
| SQL expressions | `datetime('now')` for current UTC timestamp |
| TypeScript | `new Date().toISOString()` for current UTC ISO string |
| Stored format | ISO 8601 strings (`"2026-05-14T06:00:00.000Z"`) in `TEXT` columns |
| No `Date` objects in DB | Always stringify before writing; parse on read |

---

## Routines

- Routine prompts live in `routines/*.md`. They are natural-language instructions for the Anthropic `/schedule` runtime.
- **Do not write TypeScript API client code for routines.** The runtime reads the prompt and issues HTTP/SQL calls directly.
- LLM calls that happen inside routines are made by the Anthropic infrastructure (covered by Max subscription). Hub-side LLM calls use `getAnthropic()` from `src/llm/client.ts`.
- Cloud routine SQL goes in code blocks in the `.md` file. That is the pattern; see `routines/harvestapi.md` as the reference example.

---

## Migrations

- File naming: `NNN_descriptive_name.sql` where `NNN` is zero-padded sequential number (`001`, `002`, ...).
- Use idempotent statements where possible: `INSERT OR IGNORE`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Never modify a migration that has already been applied. Create a new one.
- Apply: `npm run db:migrate`. The runner tracks applied migrations in the `_migrations` table.

---

## Environment variables

| File | Used by |
|---|---|
| `.env` (root) | Hub (`getDb()`), scripts (`run-harvestapi.ts`, `run-tailor.ts`), tests |
| `agent/.env` | Local Agent only — not the root project |

These are separate. The agent does **not** read root `.env`. See [gotchas](gotchas.md).
