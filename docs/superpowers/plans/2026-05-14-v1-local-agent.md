# v1 Local Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Local Agent — a separate Node.js project under `agent/` that runs on the user's Windows machine. Pulls `ready` non-ATS applications from Turso, opens them via CDP to a Chrome instance the user is already logged into, fills the form using the application's resume PDF + cover letter + Q&A KB, stops at the Submit button. User clicks. Application moves to `submitted` on click.

**Architecture:** Separate `package.json` and entry point under `agent/`. Shares the Turso DB with the Hub. Uses `playwright-core` with `chromium.connectOverCDP()` rather than launching its own browser — that way the user's logged-in sessions for LinkedIn / Workday / company SSO are reused safely (lowest detection risk + the only way to handle auth-required sites).

**Tech Stack:** Node.js 18+ · TypeScript (`tsx` for execution) · `playwright-core` · `@libsql/client` (shared with Hub) · `dotenv`.

**Spec:** `docs/superpowers/specs/2026-05-14-v1-application-pipeline-design.md` §6.3 — read first.

**Prerequisite:** the Hub plan's Stages 1, 2, 3, 6 must be complete (DB schema, applications state machine, Q&A KB matcher). This plan depends on those modules at import time.

---

## File structure

```
agent/                                    (NEW project root)
  package.json                            (NEW)
  tsconfig.json                           (NEW)
  README.md                               (NEW)
  .env.example                            (NEW)
  src/
    index.ts                              (NEW — CLI entry point)
    config.ts                             (NEW — env loading + paths)
    chrome.ts                             (NEW — CDP connect / launch persistent context)
    submit-runner.ts                      (NEW — pick next ready, dispatch by ATS)
    form-fillers/
      shared.ts                           (NEW — common helpers (find file input, paste textarea))
      linkedin-easyapply.ts               (NEW)
      workday.ts                          (NEW)
      generic.ts                          (NEW — fallback for unknown sites)
    qa-bridge.ts                          (NEW — uses Hub's qa-kb + deny-list modules)
    state.ts                              (NEW — reads ready apps, writes submitted/submit_failed)
  scripts/
    setup-chrome-cdp.md                   (NEW — instructions to user)
tests/                                    (in agent/tests, separate from Hub)
  form-fillers/
    shared.test.ts                        (NEW)
```

---

## Conventions

- **Same TDD pattern as Hub:** failing test → confirm fail → implement → confirm pass → commit.
- **Shared modules:** import Hub modules via relative paths (e.g. `../../src/core/qa/...`) using TS path-alias resolution from the agent's own `tsconfig.json`.
- **Process model:** the agent is a CLI, not a daemon. User runs `npm run agent` once. It picks one ready application, walks the user through it, exits. (Why one-shot: avoids the user accidentally leaving it running while doing unrelated work.)
- **No durable state:** all state lives in Turso. The agent is stateless.
- **Commits:** `feat(agent): ...`.

---

# Stage L1 — Project setup

### Task L1.1: agent/ package + tooling

**Files:**
- Create: `agent/package.json`
- Create: `agent/tsconfig.json`
- Create: `agent/.env.example`
- Modify: root `package.json` to add `npm run agent` script

- [ ] **Step 1: agent/package.json**

```json
{
  "name": "job-hunter-agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "agent": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@libsql/client": "^0.17.3",
    "dotenv": "^17.4.2",
    "playwright-core": "^1.55.0"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.21.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 2: agent/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@hub/*": ["../src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: agent/.env.example**

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN_AGENT=eyJ...   # scoped to applications read/write only

# Chrome CDP endpoint — start Chrome with --remote-debugging-port=9222 first.
# Setup: see scripts/setup-chrome-cdp.md
CHROME_CDP_URL=http://localhost:9222

# Where the agent downloads the resume PDF temporarily before uploading to forms
TEMP_DOWNLOAD_DIR=./tmp
```

- [ ] **Step 4: Root package.json — add convenience script**

In the root `package.json`, add to scripts:

```json
"agent": "cd agent && npm run agent"
```

- [ ] **Step 5: Install agent deps**

Run: `cd agent && npm install`
Expected: `node_modules/` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add agent/package.json agent/tsconfig.json agent/.env.example package.json
git commit -m "feat(agent): scaffold separate Node project under agent/"
```

### Task L1.2: Chrome CDP setup instructions

**Files:**
- Create: `agent/scripts/setup-chrome-cdp.md`

- [ ] **Step 1: Write the setup doc**

```markdown
# Connecting the Local Agent to your Chrome

The agent uses your existing logged-in Chrome session via the Chrome DevTools
Protocol (CDP). This means LinkedIn/Workday/etc. don't see a fresh Playwright
context — they see your normal browser, with all your cookies and sessions.

## One-time setup (Windows)

1. Quit all Chrome windows. (Right-click the Chrome tray icon → Exit.)

2. Create a new shortcut to Chrome with these flags:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\AppData\Local\Google\Chrome\User Data"
   ```

   Adjust paths if Chrome is installed somewhere else. Keep `--user-data-dir`
   pointing at your *existing* user profile so your cookies / saved logins are
   reused.

3. Save the shortcut as e.g. "Chrome (Job Hunter)" on your desktop.

4. Launch Chrome via this shortcut from now on when you want to run the agent.

5. Verify: open http://localhost:9222 in another tab. You should see a page
   listing your open tabs with `Webview` and `Page` types.

## When the agent runs

- `npm run agent` connects via `connectOverCDP("http://localhost:9222")`.
- It opens new tabs as needed; does NOT take over your existing tabs.
- It will pause at the final Submit button — never clicks Submit itself.
- You click Submit. Agent detects success or failure and updates the DB.

## If Chrome isn't running with `--remote-debugging-port`

The agent will print:
```
ERROR: Could not connect to Chrome at http://localhost:9222.
Start Chrome via the "Chrome (Job Hunter)" shortcut and try again.
```
```

- [ ] **Step 2: Commit**

```bash
git add agent/scripts/setup-chrome-cdp.md
git commit -m "docs(agent): Chrome CDP setup instructions for Windows"
```

---

# Stage L2 — CDP connection + state bridge

### Task L2.1: Chrome connect helper

**Files:**
- Create: `agent/src/chrome.ts`

- [ ] **Step 1: Implement**

```typescript
// agent/src/chrome.ts
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

export interface ChromeConnection {
  browser: Browser;
  context: BrowserContext;
  newPage(): Promise<Page>;
}

export async function connectToChrome(cdpUrl: string): Promise<ChromeConnection> {
  let browser: Browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl);
  } catch (err) {
    throw new Error(
      `Could not connect to Chrome at ${cdpUrl}.\n` +
      `Start Chrome with --remote-debugging-port=9222 (see agent/scripts/setup-chrome-cdp.md).\n` +
      `Underlying error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  // connectOverCDP returns an existing browser; the first context is the user's profile.
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error("Chrome connected but no contexts found — open a Chrome window first.");
  }
  const context = contexts[0];
  return {
    browser,
    context,
    newPage: () => context.newPage(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/chrome.ts
git commit -m "feat(agent): Chrome CDP connection helper"
```

### Task L2.2: State bridge — read ready, write submitted

**Files:**
- Create: `agent/src/state.ts`

- [ ] **Step 1: Implement**

```typescript
// agent/src/state.ts
import { createClient, type Client } from "@libsql/client";

export interface ReadyApplication {
  id: string;
  job_id: string;
  title: string;
  company_name: string;
  apply_url: string;
  ats_vendor: string | null;
  resume_pdf_path: string | null;
  cover_letter_md: string | null;
  qa_answers_json: string;
}

export function getAgentDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const auth = process.env.TURSO_AUTH_TOKEN_AGENT;
  if (!url || !auth) throw new Error("TURSO_DATABASE_URL + TURSO_AUTH_TOKEN_AGENT required");
  return createClient({ url, authToken: auth });
}

/** Pick the next ready application destined for the Local Agent (non-ATS or click_to_send). */
export async function pickNextReady(db: Client): Promise<ReadyApplication | null> {
  const { rows } = await db.execute(`
    SELECT a.id, a.job_id, a.resume_pdf_path, a.cover_letter_md, a.ats_vendor, a.qa_answers_json,
           j.title, j.company_name, j.apply_url
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
     WHERE a.state = 'ready' AND a.channel = 'local_agent'
  ORDER BY a.created_at ASC
     LIMIT 1
  `);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    job_id: r.job_id as string,
    title: r.title as string,
    company_name: r.company_name as string,
    apply_url: r.apply_url as string,
    ats_vendor: (r.ats_vendor as string) || null,
    resume_pdf_path: (r.resume_pdf_path as string) || null,
    cover_letter_md: (r.cover_letter_md as string) || null,
    qa_answers_json: (r.qa_answers_json as string) || "[]",
  };
}

export async function markSubmitted(db: Client, applicationId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE applications SET state = 'submitted', submitted_at = datetime('now'),
                                   updated_at = datetime('now') WHERE id = ?`,
    args: [applicationId],
  });
}

export async function markFailed(
  db: Client,
  applicationId: string,
  reason: string,
  screenshotPath: string | null
): Promise<void> {
  await db.execute({
    sql: `UPDATE applications SET state = 'submit_failed',
                                   failure_reason = ?, failure_screenshot_path = ?,
                                   updated_at = datetime('now')
            WHERE id = ?`,
    args: [reason, screenshotPath, applicationId],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/state.ts
git commit -m "feat(agent): state bridge (pickNextReady / markSubmitted / markFailed)"
```

---

# Stage L3 — Form fillers

The Local Agent's actual job. Three filler modules cover the high-value vendors; a generic fallback handles everything else.

### Task L3.1: Shared form-filler helpers

**Files:**
- Create: `agent/src/form-fillers/shared.ts`
- Create: `agent/tests/form-fillers/shared.test.ts`

- [ ] **Step 1: Failing test for label-to-field matching**

```typescript
// agent/tests/form-fillers/shared.test.ts
import { describe, it, expect } from "vitest";
import { matchLabelToField } from "@/agent/src/form-fillers/shared";

describe("matchLabelToField", () => {
  it("matches 'First Name' label to first_name input", () => {
    expect(matchLabelToField("First Name", ["first_name", "name", "email"])).toBe("first_name");
  });
  it("returns null on no match", () => {
    expect(matchLabelToField("Favorite color", ["first_name", "email"])).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// agent/src/form-fillers/shared.ts
import type { Page, Locator } from "playwright-core";

/**
 * Match a form-field label to a candidate field name by normalizing both sides
 * (lowercase, strip punctuation/whitespace, alias common variants).
 */
const ALIASES: Record<string, string[]> = {
  "first_name": ["first name", "firstname", "given name"],
  "last_name":  ["last name", "lastname", "family name", "surname"],
  "email":      ["email", "email address", "e-mail"],
  "phone":      ["phone", "phone number", "mobile", "tel"],
  "linkedin":   ["linkedin", "linkedin profile", "linkedin url"],
  "github":     ["github", "github profile", "github url"],
  "portfolio":  ["portfolio", "website", "personal site"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchLabelToField(label: string, candidates: string[]): string | null {
  const n = norm(label);
  for (const c of candidates) {
    if (n === norm(c)) return c;
    const aliases = ALIASES[c] ?? [];
    for (const a of aliases) if (n === norm(a)) return c;
  }
  return null;
}

/** Wait for a file input then upload the path. Some sites hide the real input behind a styled button. */
export async function uploadResume(page: Page, pdfPath: string): Promise<boolean> {
  const inputs = await page.locator('input[type="file"]').all();
  for (const inp of inputs) {
    try {
      await inp.setInputFiles(pdfPath);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/** Try common textarea selectors for "cover letter" / "additional info". */
export async function pasteCoverLetter(page: Page, text: string): Promise<boolean> {
  const selectors = [
    'textarea[name="cover_letter"]',
    'textarea[name="comments"]',
    'textarea[name="cover-letter"]',
    'textarea[id*="cover"]',
    'textarea[placeholder*="cover" i]',
    'textarea[aria-label*="cover" i]',
    'textarea',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0) {
      try {
        await loc.fill(text);
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

/** Stop point: highlight the Submit button so the user knows where to click. */
export async function highlightSubmit(page: Page): Promise<Locator | null> {
  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit Application")',
    'button:has-text("Submit application")',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    if (await loc.count() > 0 && await loc.isVisible()) {
      await loc.evaluate((el: HTMLElement) => {
        el.style.outline = "4px solid red";
        el.style.outlineOffset = "2px";
        el.scrollIntoView({ block: "center" });
      });
      return loc;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add agent/src/form-fillers/shared.ts agent/tests/form-fillers/shared.test.ts
git commit -m "feat(agent): shared form-filler helpers (label match, upload, paste, highlight)"
```

### Task L3.2: Generic filler (fallback for unknown sites)

**Files:**
- Create: `agent/src/form-fillers/generic.ts`

- [ ] **Step 1: Implement**

```typescript
// agent/src/form-fillers/generic.ts
import type { Page } from "playwright-core";
import type { ReadyApplication } from "../state.js";
import { matchLabelToField, uploadResume, pasteCoverLetter, highlightSubmit } from "./shared.js";

const PROFILE_FIELDS: Record<string, string> = {
  // To be populated from Hub's profile.basics_json at runtime.
};

export interface FillContext {
  application: ReadyApplication;
  profileBasics: Record<string, string>;
  qaAnswerFor(question: string): Promise<string | null>;  // returns user-verified answer or null
  denyListMatch(question: string): Promise<string | null>; // returns matched pattern or null
}

export interface FillResult {
  ok: boolean;
  reason?: string;
  qa_log: Array<{ question: string; answer: string | null }>;
}

/**
 * Generic filler: walk all visible <input>, <textarea>, <select> elements;
 * find each one's label; route to:
 *  - resume upload helper (if file input)
 *  - cover letter paste (if textarea AND label/placeholder mentions cover)
 *  - profile-field map (matchLabelToField for first_name/email/etc)
 *  - QA KB (use stored answer if pattern matches)
 *  - deny list (halt if matched)
 *  - unknown required field → halt
 */
export async function fillGeneric(page: Page, ctx: FillContext): Promise<FillResult> {
  const qaLog: FillResult["qa_log"] = [];

  // 1) Upload resume.
  if (ctx.application.resume_pdf_path) {
    await uploadResume(page, ctx.application.resume_pdf_path);
  }

  // 2) Walk form fields.
  const fields = await page.locator("input:visible, textarea:visible, select:visible").all();
  for (const f of fields) {
    const tag = await f.evaluate((el) => el.tagName.toLowerCase());
    const type = (await f.getAttribute("type")) ?? "";
    if (type === "file" || type === "hidden" || type === "submit") continue;
    if (tag === "input" && ["radio", "checkbox"].includes(type)) continue;

    const labelText = await getFieldLabel(f);
    if (!labelText) continue;

    // Deny-list check.
    const denied = await ctx.denyListMatch(labelText);
    if (denied) {
      return { ok: false, reason: `deny-list match: ${denied}`, qa_log: qaLog };
    }

    // Cover letter heuristic.
    if (tag === "textarea" && /cover|why|interest/i.test(labelText) && ctx.application.cover_letter_md) {
      await f.fill(ctx.application.cover_letter_md);
      qaLog.push({ question: labelText, answer: "[cover letter pasted]" });
      continue;
    }

    // Profile-field match.
    const profileKey = matchLabelToField(labelText, Object.keys(ctx.profileBasics));
    if (profileKey) {
      await f.fill(ctx.profileBasics[profileKey] ?? "");
      qaLog.push({ question: labelText, answer: ctx.profileBasics[profileKey] });
      continue;
    }

    // KB lookup.
    const known = await ctx.qaAnswerFor(labelText);
    if (known) {
      await f.fill(known);
      qaLog.push({ question: labelText, answer: known });
      continue;
    }

    // Required + unknown → halt.
    const required = (await f.getAttribute("required")) !== null || (await f.getAttribute("aria-required")) === "true";
    if (required) {
      return { ok: false, reason: `unknown required field: ${labelText}`, qa_log: qaLog };
    }
    qaLog.push({ question: labelText, answer: null });
  }

  // 3) Cover letter fallback (some sites use textarea outside the labeled fields).
  if (ctx.application.cover_letter_md) {
    await pasteCoverLetter(page, ctx.application.cover_letter_md);
  }

  // 4) Highlight Submit.
  const submitLoc = await highlightSubmit(page);
  if (!submitLoc) return { ok: false, reason: "no Submit button found", qa_log: qaLog };
  return { ok: true, qa_log: qaLog };
}

/** Find the label text for a form field by trying <label for=ID>, parent <label>, aria-label, placeholder. */
async function getFieldLabel(field: import("playwright-core").Locator): Promise<string | null> {
  return field.evaluate((el) => {
    const inp = el as HTMLInputElement;
    const id = inp.id;
    if (id) {
      const lbl = document.querySelector(`label[for="${id}"]`);
      if (lbl) return (lbl.textContent ?? "").trim();
    }
    const parentLabel = inp.closest("label");
    if (parentLabel) return (parentLabel.textContent ?? "").trim();
    const aria = inp.getAttribute("aria-label");
    if (aria) return aria;
    const placeholder = inp.getAttribute("placeholder");
    if (placeholder) return placeholder;
    return null;
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/form-fillers/generic.ts
git commit -m "feat(agent): generic form filler (deny-list + KB + profile-field matching)"
```

### Task L3.3: LinkedIn Easy Apply filler

**Files:**
- Create: `agent/src/form-fillers/linkedin-easyapply.ts`

LinkedIn Easy Apply is a multi-step modal. Each step has different fields. The filler needs to detect each step and route.

- [ ] **Step 1: Implement**

```typescript
// agent/src/form-fillers/linkedin-easyapply.ts
import type { Page } from "playwright-core";
import type { FillContext, FillResult } from "./generic.js";
import { fillGeneric } from "./generic.js";

/**
 * LinkedIn Easy Apply walks through 2-5 modal steps. We click "Next" between
 * filled steps. Stop when we see "Review" or "Submit application" — never click those.
 */
export async function fillLinkedInEasyApply(page: Page, ctx: FillContext): Promise<FillResult> {
  // The Easy Apply modal opens after clicking "Easy Apply" button.
  const easyApplyBtn = page.locator('button:has-text("Easy Apply")').first();
  if (await easyApplyBtn.count() === 0) {
    return { ok: false, reason: "no Easy Apply button on page", qa_log: [] };
  }
  await easyApplyBtn.click();
  await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

  let stepCount = 0;
  const maxSteps = 5;
  const aggregateLog: FillResult["qa_log"] = [];

  while (stepCount < maxSteps) {
    stepCount++;
    // Fill whatever is on this modal step using generic logic, scoped to the dialog.
    const modal = page.locator('div[role="dialog"]');
    const stepResult = await fillGeneric(modal as any /* generic walks all visible fields; dialog limits scope */, ctx);
    aggregateLog.push(...stepResult.qa_log);
    if (!stepResult.ok) {
      return { ok: false, reason: stepResult.reason, qa_log: aggregateLog };
    }

    // Click Next if present; if we see Submit / Review, stop.
    const submitLikeBtn = modal.locator('button:has-text("Submit application"), button:has-text("Review")').first();
    if (await submitLikeBtn.count() > 0) {
      // Highlight and stop.
      await submitLikeBtn.evaluate((el: HTMLElement) => {
        el.style.outline = "4px solid red";
        el.style.outlineOffset = "2px";
      });
      return { ok: true, qa_log: aggregateLog };
    }
    const nextBtn = modal.locator('button:has-text("Next")').first();
    if (await nextBtn.count() === 0) {
      return { ok: false, reason: "no Next / Submit button in modal", qa_log: aggregateLog };
    }
    await nextBtn.click();
    await page.waitForTimeout(500);
  }
  return { ok: false, reason: "exceeded max modal steps", qa_log: aggregateLog };
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/form-fillers/linkedin-easyapply.ts
git commit -m "feat(agent): LinkedIn Easy Apply multi-step modal filler"
```

### Task L3.4: Workday filler

**Files:**
- Create: `agent/src/form-fillers/workday.ts`

Workday uses `wd*.myworkdayjobs.com` URLs. The form is a SPA built with React + their own component library; selectors are based on `data-automation-id` attributes.

- [ ] **Step 1: Implement (minimal — most Workday forms are usable via the generic filler if we wait for hydration)**

```typescript
// agent/src/form-fillers/workday.ts
import type { Page } from "playwright-core";
import type { FillContext, FillResult } from "./generic.js";
import { fillGeneric } from "./generic.js";

export async function fillWorkday(page: Page, ctx: FillContext): Promise<FillResult> {
  // Workday is heavy — wait for hydration and any spinner to disappear.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  // If there's an Apply button that hasn't been clicked, click it.
  const applyBtn = page.locator('button[data-automation-id*="apply"], a:has-text("Apply")').first();
  if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
    await applyBtn.click();
    await page.waitForLoadState("networkidle");
  }

  // If a "Create Account / Sign In" interstitial appears, the user must handle SSO manually.
  if (await page.locator('text=/sign in|create account/i').first().count() > 0) {
    return { ok: false, reason: "Workday SSO required — sign in manually then re-run the agent", qa_log: [] };
  }

  return fillGeneric(page, ctx);
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/form-fillers/workday.ts
git commit -m "feat(agent): Workday filler (delegates to generic after SSO check)"
```

---

# Stage L4 — Submit runner + entry point

### Task L4.1: Submit runner — orchestrates one application

**Files:**
- Create: `agent/src/submit-runner.ts`

- [ ] **Step 1: Implement**

```typescript
// agent/src/submit-runner.ts
import type { Client } from "@libsql/client";
import { pickNextReady, markFailed } from "./state.js";
import { connectToChrome } from "./chrome.js";
import { fillGeneric } from "./form-fillers/generic.js";
import { fillLinkedInEasyApply } from "./form-fillers/linkedin-easyapply.js";
import { fillWorkday } from "./form-fillers/workday.js";
import type { FillContext, FillResult } from "./form-fillers/generic.js";
import { matchesDenyList } from "../../src/core/qa/deny-list.js";
import { listKb, findAnswer } from "../../src/core/qa/kb.js";

export interface RunnerOptions {
  cdpUrl: string;
  db: Client;
  profileBasics: Record<string, string>;
}

export interface RunnerResult {
  application_id: string | null;
  result: FillResult | null;
  message: string;
}

export async function runOneApplication(opts: RunnerOptions): Promise<RunnerResult> {
  const app = await pickNextReady(opts.db);
  if (!app) return { application_id: null, result: null, message: "no ready applications" };

  const kb = await listKb(opts.db);
  const denyPatterns = kb.filter((e) => e.deny_list).map((e) => e.pattern);

  const ctx: FillContext = {
    application: app,
    profileBasics: opts.profileBasics,
    qaAnswerFor: async (q) => findAnswer(opts.db, q),
    denyListMatch: async (q) => matchesDenyList(q, denyPatterns),
  };

  const chrome = await connectToChrome(opts.cdpUrl);
  const page = await chrome.newPage();
  await page.goto(app.apply_url, { waitUntil: "domcontentloaded" });

  let result: FillResult;
  if (/linkedin\.com\/jobs/.test(app.apply_url)) {
    result = await fillLinkedInEasyApply(page, ctx);
  } else if (/myworkdayjobs\.com/.test(app.apply_url)) {
    result = await fillWorkday(page, ctx);
  } else {
    result = await fillGeneric(page, ctx);
  }

  if (!result.ok) {
    await markFailed(opts.db, app.id, result.reason ?? "filler returned not-ok", null);
    return { application_id: app.id, result, message: `FAILED: ${result.reason}` };
  }

  return {
    application_id: app.id,
    result,
    message: `READY for click — form filled. User should review and click Submit. ` +
             `Application stays in 'ready' until you confirm submission via the Hub UI ` +
             `(the agent does NOT auto-detect Submit clicks in v1).`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add agent/src/submit-runner.ts
git commit -m "feat(agent): submit-runner orchestrates one application end-to-end"
```

### Task L4.2: CLI entry point

**Files:**
- Create: `agent/src/index.ts`
- Create: `agent/src/config.ts`

- [ ] **Step 1: Config helper**

```typescript
// agent/src/config.ts
import "dotenv/config";

export interface AgentConfig {
  cdpUrl: string;
  tempDir: string;
  profileBasics: Record<string, string>;
}

export async function loadConfig(): Promise<AgentConfig> {
  const cdpUrl = process.env.CHROME_CDP_URL ?? "http://localhost:9222";
  const tempDir = process.env.TEMP_DOWNLOAD_DIR ?? "./tmp";

  // Profile basics will come from Turso's profile table eventually; for v1 we
  // load from agent/.env to keep this CLI runnable without round-trip latency.
  const profileBasics: Record<string, string> = {
    first_name: process.env.PROFILE_FIRST_NAME ?? "",
    last_name:  process.env.PROFILE_LAST_NAME ?? "",
    email:      process.env.PROFILE_EMAIL ?? "",
    phone:      process.env.PROFILE_PHONE ?? "",
    linkedin:   process.env.PROFILE_LINKEDIN ?? "",
    github:     process.env.PROFILE_GITHUB ?? "",
  };
  return { cdpUrl, tempDir, profileBasics };
}
```

- [ ] **Step 2: Entry point**

```typescript
// agent/src/index.ts
import { loadConfig } from "./config.js";
import { getAgentDb } from "./state.js";
import { runOneApplication } from "./submit-runner.js";

async function main() {
  const cfg = await loadConfig();
  const db = getAgentDb();
  console.log("Connecting to Chrome at", cfg.cdpUrl);
  const result = await runOneApplication({
    cdpUrl: cfg.cdpUrl,
    db,
    profileBasics: cfg.profileBasics,
  });
  console.log("---");
  console.log(result.message);
  if (result.application_id) {
    console.log(`Application id: ${result.application_id}`);
  }
  console.log("---");
  console.log("Done. (Agent does not auto-close Chrome. Review the filled form, " +
              "click Submit yourself, then mark submitted via Hub UI.)");
  process.exit(result.result?.ok === false ? 1 : 0);
}

main().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(2);
});
```

- [ ] **Step 3: Add `agent/.env.example` profile fields**

Update `agent/.env.example`:
```
PROFILE_FIRST_NAME=Farhan
PROFILE_LAST_NAME=...
PROFILE_EMAIL=farhan1188@gmail.com
PROFILE_PHONE=+92...
PROFILE_LINKEDIN=https://www.linkedin.com/in/...
PROFILE_GITHUB=https://github.com/...
```

- [ ] **Step 4: Hand-test (end-to-end)**

1. Start Chrome via the shortcut from L1.2.
2. Manually insert a test `ready` application in Turso pointing at a known job URL (any open Greenhouse or LinkedIn job).
3. Run: `npm run agent`.
4. Expected: the agent opens a new tab to the apply URL, fills visible fields, highlights the Submit button with a red outline, then exits printing "READY for click".

- [ ] **Step 5: Commit**

```bash
git add agent/src/index.ts agent/src/config.ts agent/.env.example
git commit -m "feat(agent): CLI entry point + .env-based profile basics"
```

---

# Stage L5 — Submission confirmation UX

After the user clicks Submit, the application stays in `ready` until they tell the Hub. v1 doesn't auto-detect submission — this would require either monitoring the Chrome tab (fragile) or scraping the success page (also fragile). Instead, the Hub adds a "Mark as submitted" button on the detail page.

### Task L5.1: Mark-as-submitted button in the Hub

**Files:**
- Modify: `app/pipeline/[id]/tabs.tsx`
- Modify: `app/api/applications/[id]/review/route.ts` (add `action: 'mark_submitted'`)

- [ ] **Step 1: Add the action**

In `app/api/applications/[id]/review/route.ts`, add to the POST handler:

```typescript
if (action === "mark_submitted") {
  await transition(db, id, "submitted", { submitted_at: new Date().toISOString() });
  return NextResponse.json({ ok: true, state: "submitted" });
}
```

- [ ] **Step 2: Add a button on the detail page**

In `app/pipeline/[id]/tabs.tsx`, when `state === 'ready' && channel === 'local_agent'`, add a "Mark as submitted" button alongside the agent-instructions text. Clicking it POSTs to the review route with `action: 'mark_submitted'`.

- [ ] **Step 3: Commit**

```bash
git add app/pipeline app/api/applications
git commit -m "feat(pipeline): mark-as-submitted button for Local Agent flow"
```

---

# Spec coverage check

| Spec section | Task |
|---|---|
| §6.3 Local Agent | L1-L5 (entire plan) |
| §6.3.1 Submit mode | L4.1 |
| §6.3.2 LinkedIn Saved-Jobs | DROPPED per scope refinement (see spec §2) |
| CDP-connect to existing Chrome | L1.2, L2.1 |
| Q&A KB integration | L3.2, L4.1 (via shared.ts + state.ts) |
| Deny-list halt | L3.2 (denyListMatch in FillContext) |
| Stops at Submit button | L3.1 highlightSubmit |
| Mark submitted via Hub | L5.1 |

---

# Smoke tests (post-build)

Documented as `docs/v1-smoke-tests.md` in a follow-up; this list lives here as the spec-required manual verification.

1. **Generic non-ATS site** (e.g. a Lever job in `click_to_send` mode): `npm run agent` → form fills, Submit highlighted, no auto-click. After manual click, "Mark as submitted" in Hub → state moves to submitted.
2. **LinkedIn Easy Apply**: agent walks through modal steps, stops at Review/Submit. Same confirmation flow.
3. **Workday with active SSO session**: agent fills form, stops at Submit.
4. **Workday without SSO session**: agent halts with friendly message → user signs in → re-run.
5. **Deny-list halt**: a form with a "Are you authorized to work in the US?" question → agent halts and surfaces in `quality_review`.
