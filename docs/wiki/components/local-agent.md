# Local Agent

The Local Agent fills job application forms using the user's already-running Chrome browser and stops at the Submit button. The user clicks Submit; the Hub marks the application submitted. All agent code lives in `agent/` — a separate Node.js project from the Hub.

---

## Why a separate project

The agent needs `playwright-core` (for CDP browser control), ESM module resolution, and a different dependency set from the Next.js Hub. Mixing them in the root package creates runtime conflicts and bloats the web bundle. The agent imports Hub modules via a `@hub/*` path alias (`../src/*`) configured in `agent/tsconfig.json`.

See [decisions](../decisions.md) ADR-012 and ADR-013.

---

## How to run

**From the Hub:** click the **"Run Agent"** button on `/pipeline`. This triggers `POST /api/agent/run`, which spawns the agent via `child_process.spawn('npm.cmd', ['run', 'agent'], { cwd: 'agent/' })`. Output is returned synchronously when the agent exits.

**From the terminal:**
```bash
# from repo root
npm run agent

# from agent/ directory
npm run agent
```

The agent is **one-shot**: it picks one `ready` application, walks through it, and exits. There is no daemon mode. Running it again picks the next ready application.

---

## Chrome setup

The agent connects to an existing Chrome instance via the Chrome DevTools Protocol (CDP) rather than launching a fresh browser. This is critical — it reuses the user's LinkedIn / Workday / company SSO sessions and presents as a normal browser to anti-bot systems.

**Required Chrome flags:**
```
--remote-debugging-port=9222
--user-data-dir=C:\Users\<you>\chrome-cdp-profile
```

A dedicated profile directory is required because Chrome silently drops `--remote-debugging-port` when paired with the default profile (a Google security mitigation added in 2024). See [decisions](../decisions.md) ADR-013 and `agent/scripts/setup-chrome-cdp.md` for the one-time setup steps.

**Verify:** open `http://localhost:9222` — you should see a JSON listing of open pages.

---

## File tour

```
agent/src/
  index.ts          CLI entry point — loads config, calls runOneApplication, exits
  config.ts         Reads .env: CHROME_CDP_URL, TEMP_DOWNLOAD_DIR, PROFILE_* fields
  chrome.ts         connectToChrome(cdpUrl) → { browser, context, newPage() }
  state.ts          Turso bridge: pickNextReady / markSubmitted / markFailed
  submit-runner.ts  Orchestrator: picks app, routes to filler, handles result
  form-fillers/
    shared.ts       matchLabelToField, uploadResume, pasteCoverLetter, highlightSubmit
    linkedin-easyapply.ts  Multi-step Easy Apply modal filler
    workday.ts      Workday SPA filler (delegates to generic after SSO check)
    generic.ts      Fallback: walks all visible inputs, deny-list + KB + profile-field matching
```

---

## State bridge (`agent/src/state.ts`)

Connects to Turso using `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN_AGENT` (scoped token — applications read/write only).

| Function | SQL | Notes |
|---|---|---|
| `pickNextReady(db)` | `SELECT … WHERE state='ready' AND channel='local_agent' ORDER BY created_at ASC LIMIT 1` | Returns `null` when nothing is queued |
| `markSubmitted(db, id)` | `UPDATE applications SET state='submitted', submitted_at=now()` | Called after user confirms via Hub UI |
| `markFailed(db, id, reason, screenshotPath)` | `UPDATE applications SET state='submit_failed', failure_reason=…` | Called when filler returns `ok: false` |

---

## Form-filler routing (`agent/src/submit-runner.ts`)

```
apply_url matches linkedin.com/jobs   → fillLinkedInEasyApply
apply_url matches myworkdayjobs.com   → fillWorkday
everything else                       → fillGeneric
```

### Shared helpers (`agent/src/form-fillers/shared.ts`)

| Helper | Purpose |
|---|---|
| `matchLabelToField(label, candidates)` | Normalises label text (lowercase, strip punctuation) and matches to a field name using a built-in alias table (first_name, last_name, email, phone, linkedin, github, portfolio) |
| `uploadResume(page, pdfPath)` | Iterates `input[type="file"]` locators, calls `setInputFiles` |
| `pasteCoverLetter(page, text)` | Tries common textarea selectors for cover-letter fields |
| `highlightSubmit(page)` | Finds the Submit button by common selectors, outlines it in red, scrolls into view |

### LinkedIn Easy Apply (`agent/src/form-fillers/linkedin-easyapply.ts`)

Multi-step modal filler. Clicks the "Easy Apply" button, waits for `div[role="dialog"]`, then loops through modal steps:
- Fills each step using `fillGeneric` scoped to the dialog.
- Clicks "Next" between steps.
- Stops when it sees "Submit application" or "Review" — highlights that button in red and returns `ok: true`.
- Max 5 steps before returning a failure.

### Workday (`agent/src/form-fillers/workday.ts`)

Waits for `networkidle` + 1500ms (Workday is heavy React). Clicks an Apply button if present. If a "sign in / create account" interstitial appears, returns `ok: false` with a message asking the user to log in manually in the dedicated Chrome profile. Otherwise delegates to `fillGeneric`.

### Generic (`agent/src/form-fillers/generic.ts`)

Walks all `input:visible, textarea:visible, select:visible` elements. For each field:
1. Calls `getFieldLabel` — tries `<label for=ID>`, parent `<label>`, `aria-label`, `placeholder`.
2. Runs deny-list check via `ctx.denyListMatch`. Halts if matched.
3. Cover letter heuristic — if textarea and label contains "cover"/"why"/"interest", pastes `cover_letter_md`.
4. Profile-field match via `matchLabelToField` (first_name, last_name, email, phone, etc. from agent `.env`).
5. KB lookup via `ctx.qaAnswerFor`.
6. If the field is required and still unanswered, halts with `ok: false`.

After the field loop, calls `highlightSubmit`. Returns `{ok: true, qa_log: [...]}` on success.

---

## Stops at Submit — always

The agent **never** clicks the Submit button. `highlightSubmit` outlines it with a red CSS outline and returns the locator to the orchestrator. The function name is intentional — it highlights, not clicks.

After the user clicks Submit in Chrome, they return to the Hub and click "Mark as submitted" on the application detail page (`POST /api/applications/[id]/review` with `action: 'mark_submitted'`). The agent does not auto-detect submission success.

---

## Configuration (`agent/.env`)

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN_AGENT=eyJ...    # applications read/write scope
CHROME_CDP_URL=http://localhost:9222
TEMP_DOWNLOAD_DIR=./tmp

PROFILE_FIRST_NAME=...
PROFILE_LAST_NAME=...
PROFILE_EMAIL=...
PROFILE_PHONE=...
PROFILE_LINKEDIN=...
PROFILE_GITHUB=...
```

Profile fields are loaded from `agent/.env` in v1 (fast iteration); a follow-up will pull them from the Turso `profile` table at runtime.
