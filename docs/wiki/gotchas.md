# Gotchas

Non-obvious pitfalls encountered in this project. Each entry has a symptom, cause, fix, and why it was tricky. When you hit something new, append it here.

Related: [conventions](conventions.md) | [architecture](architecture.md) | [decisions](decisions.md)

---

## Apify HarvestAPI returns wildly off-topic jobs

**You'll see:** `npm run ingest:linkedin` succeeds, but the dataset contains random unrelated roles (Receiving Manager, Attorney, Spanish logistics coordinator) with very low scores. No HTTP error, no warning.

**Cause:** The actor's input schema uses `jobTitles[]` and `locations[]` — not `searchQueries`, `locationNames`, `publishedAt`, `contractType`, `workType`, `experienceLevel`. If you pass unknown fields, Apify silently ignores them, runs the actor with **no filter**, and returns whatever's newest globally. Strict array-vs-string mismatch on a recognized field IS rejected (e.g. `experienceLevel: ""` errors with "must be array"), but unknown fields are tolerated. The routine prompt at `routines/harvestapi.md` had the right shape; the script at `scripts/run-harvestapi.ts` diverged.

**Fix:** Match the schema exactly: `{ jobTitles: string[], locations: string[], maxItems: number, sortBy: "date" }`. See `scripts/run-harvestapi.ts` for the working version. Real schema: https://apify.com/harvestapi/linkedin-job-search/input-schema.

**Why it's tricky:** Silent failure mode — looks like the system is "working" because jobs are arriving. Only the scorer revealed they were garbage. Also: `maxItems` is **per (title × location) pair**, not per-run, so 9 titles × 9 locations × 25 = 2,025 jobs. Easy to blow the Apify budget. The local script caps titles/locations via CLI flags (`--titles=N --locations=N`) to control this.

---

## `spawn typst ENOENT` on Windows even after `winget install Typst.Typst`

**You'll see:** `npm run tailor` errors with `Error: spawn typst ENOENT` in `src/core/tailor/typst-render.ts`. Yet `typst --version` works in a fresh shell.

**Cause:** Winget installs typst at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Typst.Typst_…\typst-x86_64-pc-windows-msvc\typst.exe` but doesn't always create a shim in `%LOCALAPPDATA%\Microsoft\WindowsApps\`. Git Bash inherits PATH at shell-start; even if winget eventually shims it, an already-open shell won't see it.

**Fix:** Set `TYPST_BIN` in root `.env` to the absolute path of `typst.exe`. The renderer at `src/core/tailor/typst-render.ts:82` reads `process.env.TYPST_BIN || "typst"`. Cloud routines on Linux can leave `TYPST_BIN` unset and install via `apt install typst`.

**Why it's tricky:** Different shells see different PATHs depending on when they were started. The wiki said Typst was "verified working" — and it was, in the shell where the smoke test ran. Different session, same machine, ENOENT.

---

## Haiku occasionally appends prose after JSON-only output

**You'll see:** `SyntaxError: Unexpected non-whitespace character after JSON at position N` thrown from `JSON.parse` in a quality-gate or scoring path. The system prompt explicitly says "Output JSON only" — but Haiku sometimes returns `{...}\n\nThis bullet adds claim X not in the original.`

**Cause:** Even with a strict "JSON only" instruction and `max_tokens` headroom, Haiku occasionally wraps the JSON in commentary. The `claim-equivalence.ts` parser only stripped fenced code blocks (` ```json … ``` `), not trailing prose.

**Fix:** Slice to the first balanced top-level object before parsing: `text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)`. Safe for shallow schemas (no risk of strings containing unescaped braces). The fix is in `src/core/quality/claim-equivalence.ts:33`. Long-term: switch to tool_use (forced JSON via schema). See [open-questions.md](open-questions.md).

**Why it's tricky:** Intermittent. Most calls return clean JSON; the failing one looks like a network/model issue at first. Only happens for ambiguous comparisons where the model "wants" to explain.

---

## libSQL `SELECT *` returns wrong column values

**You'll see:** A column you expect to be a string (e.g. `ats_vendor`) silently contains the value from a different column (e.g. `title`). No error is thrown.

**Cause:** The `@libsql/client` HTTP transport has a known bug where `SELECT *` returns columns in an unexpected order, misaligning values to the wrong fields.

**Fix:** Always list columns explicitly in every query.
```typescript
// WRONG
await db.execute("SELECT * FROM jobs WHERE id = ?");
// RIGHT
await db.execute({
  sql: "SELECT id, source, external_id, url, apply_url, ats_vendor, title, company_name FROM jobs WHERE id = ?",
  args: [jobId],
});
```

**Why it's tricky:** No error — just wrong data. Easy to miss in development if you only check `id` or `title` (which happen to be correct). Only catches you when you check a column that isn't in the first few positions.

---

## Chrome `--remote-debugging-port` silently ignored on default profile

**You'll see:** Chrome launches, the Local Agent runs `connectToChrome("http://localhost:9222")`, and gets `ECONNREFUSED`. The port never bound.

**Cause:** Chrome 2024+ silently drops `--remote-debugging-port` when it detects you're using the default user profile (`AppData\Local\Google\Chrome\User Data`). This is a security mitigation against malware hijacking user sessions.

**Fix:** Launch Chrome with a dedicated `--user-data-dir`:
```
chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\chrome-cdp-profile"
```
The "Chrome (Job Hunter)" desktop shortcut does this. Sign into LinkedIn once in this profile; subsequent agent runs reuse the session.

**Why it's tricky:** Chrome doesn't log a warning. The port simply never opens. Looks identical to "Chrome crashed" or "port already in use."

See ADR-013.

---

## PowerShell parses a quoted command path as a string literal

**You'll see:** `"C:\Program Files\Google\Chrome\chrome.exe" --flag` → `The term 'C:\...' is not recognized`.

**Cause:** PowerShell treats a quoted string at the start of an expression as a string value, not a command invocation.

**Fix:** Use the `&` call operator:
```powershell
& "C:\Program Files\Google\Chrome\chrome.exe" --remote-debugging-port=9222
```

**Why it's tricky:** Bash works fine with `"path/to/bin" arg`. PowerShell requires `&` explicitly. The error message looks like a missing executable rather than a syntax issue.

---

## PowerShell `&&` doesn't work in 5.1

**You'll see:** `&&: The term '&&' is not recognized as the name of a cmdlet` (or just silent failure / unexpected branching).

**Cause:** `&&` (pipeline chain operator) was added in PowerShell 7. Windows ships with PowerShell 5.1. The repo's dev environment is Windows 11 with 5.1 as default.

**Fix:** Use `; if ($?) { ... }` for conditional chaining:
```powershell
npm install; if ($?) { npm run build }
```
Or use the Bash tool for bash-style chaining.

**Why it's tricky:** Claude Code's system prompt mentions `&&` works. It does — in bash and PS 7. In PS 5.1 it silently fails or errors.

---

## Chrome CDP port won't bind if another Chrome instance is running with the same profile

**You'll see:** Agent connects to CDP but gets the user's personal Chrome session instead of the Job Hunter profile. Or the port is already bound to the wrong Chrome and the dedicated chrome gets a "port in use" error.

**Cause:** Only one Chrome instance can bind a given port or own a given `--user-data-dir` at a time. If your regular Chrome is open and somehow got given the same profile path, the CDP-enabled Chrome silently reuses the old instance.

**Fix:** Before launching the Job Hunter Chrome shortcut, verify no existing Chrome has the port:
```powershell
netstat -ano | findstr :9222
```
Kill any process holding port 9222. Then launch the shortcut fresh.

**Why it's tricky:** The agent connects successfully (to the wrong Chrome), then gets unexpected pages or session state that doesn't match the Job Hunter profile.

---

## `-ErrorAction SilentlyContinue` suppresses output but exit code is still 1

**You'll see:** A PowerShell script block returns exit 1 even though you wrapped the failing cmdlet in `-ErrorAction SilentlyContinue` and expected it to be suppressed.

**Cause:** `-ErrorAction SilentlyContinue` suppresses the error display but doesn't change the exit code. The non-terminating error still sets `$?` to `$false` and affects `$LASTEXITCODE` for native executables.

**Fix:** To truly suppress and not affect branching, use `try { ... -ErrorAction Stop } catch {}` to swallow the error entirely.

**Why it's tricky:** Looks like the error is handled but the upstream caller (or CI) still sees a failure exit.

---

## `SELECT *` from `_migrations` is safe, but a footgun everywhere else

**You'll see:** Migration bookkeeping code does `SELECT * FROM _migrations` and works fine.

**Cause:** `_migrations` has only two columns (`filename`, `applied_at`). With two columns and no type ambiguity, the `SELECT *` order-mismatch bug is harmless. This can lull you into thinking `SELECT *` is OK.

**Fix:** It's only coincidentally safe here. **Never use `SELECT *` on any application table** (jobs, applications, profile, settings, adapters, etc.). List columns explicitly everywhere. There is no linter guard.

**Why it's tricky:** The migration runner uses `SELECT *` correctly, so it never triggers the bug. New contributors may copy that pattern and apply it elsewhere.

---

## `submit_mode = 'auto_submit'` with `daily_cap = 0` silently blocks all submissions

**You'll see:** The Submit routine runs, finds eligible applications, but submits zero. No error in `routine_runs`. Cadence governor logs "daily cap is 0 (footgun guard)."

**Cause:** `daily_cap = 0` is not "unlimited" — the cadence governor (`src/core/submit/cadence.ts:38`) explicitly returns `ok: false` with reason "daily cap is 0 (footgun guard)" to prevent accidental mass-submits when the cap is unset.

**Fix:** Set `daily_cap` to an explicit value (e.g. 5) on the adapter row via `/settings`. The `settings.daily_cap` default is also 0, so you must set it at either the adapter level or the global level.

**Why it's tricky:** `0` typically means "unlimited" in many systems. The guard message appears in `routine_runs.stats_json` but not in the UI health dashboard — you have to check Turso directly or read the routine output.

See `adapters.daily_cap` docs in [data-model](data-model.md).

---

## Outreach API route deferred to Task 9.1 — importing `draftOutreach` early would fail compile

**You'll see:** If you try to call `draftOutreach` from `src/core/outreach/draft.ts` in any API route before `app/api/applications/[id]/outreach/route.ts` is created, Next.js build passes but the route 404s or the import is dangling.

**Cause:** The Hub plan deferred the outreach API route to Task 9.1. `draftOutreach` was written in Task 4.3 but the API route that exposes it to the UI was not created until later. The function existed on disk; the HTTP surface didn't.

**Fix:** Always check whether the API route exists before wiring up a UI button. The implementation (`draftOutreach`) and the API route (`/api/applications/[id]/outreach/route.ts`) are separate units — both must exist for the feature to work.

**Why it's tricky:** TypeScript compiles fine because the function is just imported and not called yet. The failure is silent until someone clicks the "Draft outreach" button in the UI.

---

## Routine prompts run in a different environment — no `getDb()`, no TypeScript

**You'll see:** A routine prompt that tries to import `@/src/db/client` or call `getDb()` fails with a module-not-found error, or simply doesn't execute the import at all (cloud runtime ignores it).

**Cause:** Cloud routines are natural-language markdown prompts executed by the Anthropic `/schedule` runtime. That runtime has no access to the repo's TypeScript source. It uses Turso's HTTP API or the Turso CLI directly via bash commands in the prompt's code blocks. `getDb()` is a Hub-only construct.

**Fix:** Routines write SQL inline as strings, not via TypeScript. Hub writes TypeScript. Never mix the two mental models. See `routines/*.md` for the pattern: raw SQL in code blocks, Turso API endpoint directly.

**Why it's tricky:** Both environments talk to the same Turso database, so they look like they share an interface. But they don't share any code.

---

## Typst CLI must be on PATH for resume rendering

**You'll see:** `typst exit 1: command not found` when running `npm run tailor` or when the Tailor routine tries to render a PDF.

**Cause:** `src/core/tailor/typst-render.ts` calls `spawn("typst", ...)`. If `typst` isn't on PATH, Node spawns nothing and the error surfaces as a child process error.

**Fix:**
- Windows: `winget install Typst.Typst`
- After install, **close and reopen** the terminal — PATH changes don't propagate to existing shells.
- Verify: `typst --version` (confirmed working: v0.14.2)
- For cloud routines: verify `typst` is available in the Anthropic routine execution environment. If not, the routine must install it in a setup step. _TBD: routine environment availability unconfirmed._

**Why it's tricky:** The error from `spawn` looks like a generic crash rather than a missing-binary problem. On Windows, newly installed PATH entries don't take effect without a shell restart.

---

## `agent/.env` is separate from root `.env`

**You'll see:** Local Agent starts but can't read `TURSO_DATABASE_URL`. The root `.env` has the value; the agent seems to ignore it.

**Cause:** `agent/src/config.ts` uses `dotenv/config` which reads `agent/.env`, not the root `.env`. The two projects are separate (`agent/` has its own `package.json`, own `.env`).

**Fix:** Copy relevant values into `agent/.env`:
```
TURSO_DATABASE_URL=<same as root .env>
TURSO_AUTH_TOKEN_AGENT=<agent-scoped token or TURSO_AUTH_TOKEN_FULL>
CHROME_CDP_URL=http://localhost:9222
PROFILE_FIRST_NAME=...
```

**Why it's tricky:** Running `npm run agent` from the repo root feels like "one project." But the agent reads its own dotenv. Confusion is especially bad because the Hub (root project) works fine with root `.env` while the agent silently reads empty strings.

---

## `harvestApiToJobPosting` returns `ats_vendor: null` (not undefined)

**You'll see:** Code that checks `if (posting.ats_vendor)` works fine. Code that checks `if (posting.ats_vendor !== undefined)` may behave unexpectedly when ATS is unknown.

**Cause:** `harvestApiToJobPosting` (`src/core/discovery/harvestapi-ingest.ts:49`) always sets `ats_vendor: normalizeAts(...) ?? null`. When the actor field is missing or unrecognized, the result is `null`, not `undefined`. The `JobPosting` type uses `ats_vendor?: string | null | undefined` to accept both forms (widened after commit 14f7203).

**Fix:** Check `if (posting.ats_vendor)` (falsy check covers both null and undefined). Don't use strict `=== undefined` equality.

**Why it's tricky:** TS typing allows `undefined` (optional field) and the type widening was added precisely because the two callers return different sentinel values. The type union hides the practical distinction.

---

## Vitest JSON fixture imports lose union-literal narrowing

**You'll see:** TypeScript error: `Type 'string' is not assignable to type '"remote" | "hybrid" | "on_site" | null'` when importing a JSON fixture file that contains one of these values.

**Cause:** Vitest imports JSON as a plain object with widened string types. A field typed `"remote" | "hybrid" | "on_site" | null` in the interface loses its narrow type when the value comes from JSON.

**Fix:** Cast the fixture import:
```typescript
import fixtureRaw from "./fixtures/harvest-item.json";
const fixture = fixtureRaw as unknown as HarvestApiItem[];
```

**Why it's tricky:** The error points at the fixture, not at the usage site. TypeScript infers JSON types broadly and the widening is invisible until you try to pass the imported value to a function with a narrow parameter type.

---

## `vi.fn` mock.calls has loose types — callers need typed signature

**You'll see:** TypeScript complains about `mock.calls[0][0]` having type `unknown` or cannot index into `mock.calls`.

**Cause:** `vi.fn()` without a type parameter returns `MockInstance<unknown[], unknown>`. `mock.calls` is then `unknown[][]`.

**Fix:** Provide the full function signature:
```typescript
const mockFetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
```
Then `mock.calls[0][0]` is `RequestInfo | URL` without manual casting.

**Why it's tricky:** Plain `vi.fn()` works fine for simple cases. The lack of type parameter only surfaces when you need to inspect call arguments in assertions.
