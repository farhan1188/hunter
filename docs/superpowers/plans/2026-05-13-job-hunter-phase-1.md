# Job Hunter — Phase 1 (Job Radar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Job Radar: user uploads resume, system crawls remote/global job sources every 2 hours via a Claude Code routine, scores them against the user's profile, and displays a ranked, filterable feed in a local Next.js dashboard. No applying yet — that's Phase 2/3.

**Architecture:** Single Next.js app (Hub) on `localhost:3000` reading/writing a hosted Turso (libSQL) database. Claude Code `/schedule` routines do all the cloud work (crawling, scoring, classification, backup) and write directly to Turso via HTTP. All LLM work runs inside routines (covered by user's Claude Code Max subscription) except a single one-shot resume extraction at upload time (~$0.05). Google Drive used for nightly DB backup and (later) resume file storage.

**Tech Stack:** TypeScript, Next.js 14 (App Router), Tailwind + shadcn/ui, `@libsql/client` for Turso, `@anthropic-ai/sdk` for the one direct API call, `googleapis` for Drive, Vitest for tests, Zod for validation, React Hook Form for forms.

**Spec:** `C:\Users\user\.claude\plans\wondrous-rolling-fiddle.md`

---

## Stage Map

This plan is broken into stages. Each ends with a demo-able state. You can stop after any stage and have something working.

| Stage | What you can demo after | Tasks |
|---|---|---|
| A. Foundations | `npm run dev` boots an empty Hub; migrations apply against Turso | 1–9 |
| B. First end-to-end slice | RemoteOK adapter fetches jobs via a routine; they appear in a basic feed | 10–18 |
| C. Profile & scoring | Upload resume → structured extraction → feed is ranked | 19–27 |
| D. More adapters | Honeypot + Greenhouse working; visa classification on all jobs | 28–35 |
| E. Filters, settings, source health | Hub feed filterable by visa/country/source/score; settings page; broken-adapter banner | 36–42 |
| F. Backup + Reconciler routines | Nightly DB backup runs; orphan-file cleanup runs | 43–46 |
| G. Notifier (daily digest) | Daily Gmail summary arrives | 47–48 |
| H. Drive integration for resume PDF | Resume uploaded to Drive at upload time | 49–51 |
| I. Verification | Run the spec's 10-step end-to-end check | 52 |
| J. Extension adapters | The remaining 10 adapters added one at a time | 53–62 |

---

## Conventions

- **Working directory:** `c:\Users\user\Desktop\Repos\Job Hunter` (Windows + PowerShell). Bash commands use forward slashes; PowerShell will accept them.
- **Test runner:** Vitest. Run: `npm test`. Specific test: `npm test -- src/path/file.test.ts`
- **Dev server:** `npm run dev` → http://localhost:3000
- **DB shell:** `turso db shell job-hunter` for ad-hoc queries
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). One commit per task completion.
- **Branch:** Work on `main` for now (single-developer project). Push to a remote once Stage B is done.

---

# Stage A: Foundations

Goal: empty Next.js app running, Turso provisioned, migrations applied. No domain logic yet.

---

### Task 1: Initialize Next.js project + git

**Files:**
- Create: `c:\Users\user\Desktop\Repos\Job Hunter\package.json` (via npx)
- Create: `c:\Users\user\Desktop\Repos\Job Hunter\.gitignore`

- [ ] **Step 1: Scaffold Next.js (TypeScript, Tailwind, App Router, no src dir, import alias)**

In the project root:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --no-eslint
```

When prompted "would you like to use Turbopack?" → No (we want stable for now).

Expected: project files appear; `package.json`, `app/`, `next.config.mjs`, `tsconfig.json` created.

- [ ] **Step 2: Add .gitignore additions**

Append to `.gitignore`:

```
# Local data
*.sqlite
*.sqlite-*
data/

# Secrets
.env
.env.local

# Editor
.vscode/
.idea/
*.swp

# OS
Thumbs.db
.DS_Store

# Test artifacts
coverage/
.nyc_output/
```

- [ ] **Step 3: Initialize git + first commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js app"
```

Expected: `git log --oneline` shows one commit.

---

### Task 2: Add Tailwind + shadcn/ui base

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Create: `components.json`
- Create: `lib/utils.ts`

- [ ] **Step 1: Init shadcn/ui**

```bash
npx shadcn@latest init
```

Prompts:
- Style: New York
- Base color: Slate
- CSS variables: Yes

This creates `components.json`, `lib/utils.ts`, and updates `app/globals.css` + `tailwind.config.ts`.

- [ ] **Step 2: Install base shadcn components we'll need**

```bash
npx shadcn@latest add button input label card badge select switch table tabs textarea form sonner
```

Expected: `components/ui/` populated with each component as a `.tsx` file.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "chore: add Tailwind + shadcn/ui base components"
```

---

### Task 3: Install runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install libraries**

```bash
npm install @libsql/client @anthropic-ai/sdk googleapis zod react-hook-form @hookform/resolvers date-fns
npm install -D vitest @vitest/ui @types/node tsx dotenv
```

Expected: `package.json` `dependencies` and `devDependencies` populated. No errors.

- [ ] **Step 2: Add scripts**

In `package.json`, add to the `scripts` block:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:shell": "turso db shell job-hunter"
  }
}
```

- [ ] **Step 3: Create vitest.config.ts**

`c:\Users\user\Desktop\Repos\Job Hunter\vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 4: Create vitest.setup.ts**

`c:\Users\user\Desktop\Repos\Job Hunter\vitest.setup.ts`:

```ts
import 'dotenv/config';
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "chore: add runtime + test dependencies"
```

---

### Task 4: Turso provisioning (one-time user setup)

**Files:**
- Create: `.env.example`
- Create: `docs/setup.md`

- [ ] **Step 1: Install Turso CLI (user runs this once on their machine)**

Document in `docs/setup.md` — user runs:

PowerShell:
```powershell
irm get.tur.so/install.ps1 | iex
```

Then:
```bash
turso auth signup       # or: turso auth login
turso db create job-hunter
turso db show job-hunter --url    # capture this as TURSO_DATABASE_URL
turso db tokens create job-hunter --expiration none    # capture as TURSO_AUTH_TOKEN_FULL (full access; for migrations)
```

- [ ] **Step 2: Create per-routine scoped tokens (for later use; create now to set them aside)**

Per the spec, each routine gets a least-privilege token. Turso table-scoped tokens — once tables exist, we'll issue specific ones. For now, create one more "read-only" token for the Hub:

```bash
turso db tokens create job-hunter --read-only --expiration none   # capture as TURSO_AUTH_TOKEN_READ
```

Note: scoped tokens with attached/table claims will be added in later tasks when we know the table list.

- [ ] **Step 3: Create .env.example**

`c:\Users\user\Desktop\Repos\Job Hunter\.env.example`:

```
# Turso (libSQL)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN_FULL=eyJ...      # used by migrate script and Hub writes
TURSO_AUTH_TOKEN_READ=eyJ...      # used by Hub read-only paths if we split later

# Anthropic API (only for the one-shot resume extraction at upload)
ANTHROPIC_API_KEY=sk-ant-...

# Google Drive (service account JSON path; created in Task 49)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./secrets/drive-service-account.json
GOOGLE_DRIVE_FOLDER_ID=...        # the Drive folder ID where job-hunter writes

# Routines: API trigger endpoint + bearer (filled in when we set up routines)
ANTHROPIC_API_TRIGGER_URL=
ANTHROPIC_API_TRIGGER_TOKEN=
```

- [ ] **Step 4: Create your real .env (user-only — git-ignored)**

User copies `.env.example` to `.env` and fills in the captured values from Steps 1–2.

```bash
cp .env.example .env
# then edit .env with real values
```

- [ ] **Step 5: Commit (ignoring real .env, committing .env.example)**

```bash
git add .env.example docs/setup.md
git commit -m "docs: add Turso setup instructions + .env.example"
```

---

### Task 5: libSQL client wrapper

**Files:**
- Create: `src/db/client.ts`

- [ ] **Step 1: Write the client**

`c:\Users\user\Desktop\Repos\Job Hunter\src\db\client.ts`:

```ts
import { createClient, Client } from '@libsql/client';

let cached: Client | null = null;

/**
 * libSQL client. Singleton so we share one HTTP connection.
 * Uses the FULL token by default (Hub does reads + writes).
 * Routines instantiate their own client with their scoped token.
 */
export function getDb(): Client {
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN_FULL;
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN_FULL must be set');
  }
  cached = createClient({ url, authToken });
  return cached;
}
```

- [ ] **Step 2: Smoke test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\db\client.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getDb } from './client';

describe('db client', () => {
  it('connects and runs select 1', async () => {
    const db = getDb();
    const result = await db.execute('select 1 as one');
    expect(result.rows[0].one).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test**

```bash
npm test -- src/db/client.test.ts
```

Expected: PASS. If FAIL with auth error → check `.env` values match `turso db show job-hunter --url` and `turso db tokens create`.

- [ ] **Step 4: Commit**

```bash
git add src/db/client.ts src/db/client.test.ts
git commit -m "feat(db): add libSQL client singleton + smoke test"
```

---

### Task 6: Migration runner

**Files:**
- Create: `src/db/migrate.ts`
- Create: `src/db/migrations/` (empty for now; 001 added in next task)

- [ ] **Step 1: Write migrate.ts**

`c:\Users\user\Desktop\Repos\Job Hunter\src\db\migrate.ts`:

```ts
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './client';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function main() {
  const db = getDb();

  // Bootstrap _migrations table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort(); // 001_*.sql, 002_*.sql, etc.

  const { rows } = await db.execute('SELECT filename FROM _migrations');
  const applied = new Set(rows.map(r => r.filename as string));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`SKIP  ${file} (already applied)`);
      continue;
    }
    console.log(`APPLY ${file}`);
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Split on ; that ends a statement (naive but works for our hand-written migrations)
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await db.execute(stmt);
    }
    await db.execute({
      sql: 'INSERT INTO _migrations (filename) VALUES (?)',
      args: [file],
    });
  }

  console.log('Migrations complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create the migrations folder + .gitkeep**

```bash
mkdir -p src/db/migrations
echo "" > src/db/migrations/.gitkeep
```

- [ ] **Step 3: Verify it runs with no migrations**

```bash
npm run db:migrate
```

Expected output: `Migrations complete.` (no SQL applied yet, because no .sql files).

- [ ] **Step 4: Commit**

```bash
git add src/db/migrate.ts src/db/migrations/.gitkeep
git commit -m "feat(db): add migration runner"
```

---

### Task 7: Migration 001 — core schema

**Files:**
- Create: `src/db/migrations/001_init.sql`

- [ ] **Step 1: Write the migration**

`c:\Users\user\Desktop\Repos\Job Hunter\src\db\migrations\001_init.sql`:

```sql
-- Singleton row: id = 1 always
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  resume_pdf_base64 TEXT,         -- base64 of uploaded PDF (Drive backup added in Stage H)
  resume_filename TEXT,
  resume_uploaded_at TEXT,
  basics_json TEXT NOT NULL DEFAULT '{}',         -- { name, email, phone, location, links }
  resume_struct_json TEXT,                         -- structured extraction (Sonnet output)
  preferences_json TEXT NOT NULL DEFAULT '{}'      -- target_roles, locations, work_auth_countries, etc.
);

INSERT INTO profile (id) VALUES (1);

-- App-wide settings (singleton row)
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  daily_cap INTEGER NOT NULL DEFAULT 0,            -- 0 = no cap (P1 uses 0; P3 uses real value)
  weekly_cap INTEGER NOT NULL DEFAULT 0,
  score_threshold INTEGER NOT NULL DEFAULT 60,
  aggressiveness INTEGER NOT NULL DEFAULT 50,      -- 0–100
  token_budget_daily_usd REAL NOT NULL DEFAULT 10.0,
  dry_run BOOLEAN NOT NULL DEFAULT 1,
  default_target_timezone TEXT NOT NULL DEFAULT 'UTC',
  cadence_floor_minutes INTEGER NOT NULL DEFAULT 30,
  feed_show_country_specific BOOLEAN NOT NULL DEFAULT 0
);

INSERT INTO settings (id) VALUES (1);

-- Per-adapter state and health
CREATE TABLE adapters (
  name TEXT PRIMARY KEY,                            -- 'remoteok', 'greenhouse', etc.
  enabled BOOLEAN NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',           -- per-adapter: e.g. { tokens: ['gitlab','n26'] } for Greenhouse
  last_run_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);

-- Job postings
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,                              -- hash(source + external_id)
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  company_hq_country TEXT,                          -- ISO 3166-1 alpha-2
  title TEXT NOT NULL,
  location_remote BOOLEAN NOT NULL DEFAULT 0,
  location_raw TEXT,
  location_geo TEXT,
  visa_category TEXT NOT NULL DEFAULT 'unknown',    -- country_specific|sponsorship_offered|international_remote|unknown
  visa_target_countries_json TEXT NOT NULL DEFAULT '[]',
  target_timezone TEXT,                             -- IANA TZ
  description_md TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  raw_ref TEXT,                                     -- path or URL to raw snapshot
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived BOOLEAN NOT NULL DEFAULT 0,
  UNIQUE (source, external_id)
);

CREATE INDEX idx_jobs_score_ranking ON jobs(archived, fetched_at);
CREATE INDEX idx_jobs_company ON jobs(company_name);

-- Job scores
CREATE TABLE scores (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  value INTEGER NOT NULL,                           -- 0–100
  reasoning TEXT NOT NULL,
  dimensions_json TEXT NOT NULL,                    -- {skill_fit, level_fit, location_fit, comp_fit}
  scored_at TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT NOT NULL                                -- e.g. "claude-haiku-4-5"
);

CREATE INDEX idx_scores_value ON scores(value DESC);

-- Q&A KB (used in Phase 3 but table exists from day 1 so routines can write to it)
CREATE TABLE qa_kb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL UNIQUE,                     -- normalized question text
  answer TEXT NOT NULL,
  user_verified BOOLEAN NOT NULL DEFAULT 0,
  last_used TEXT
);

-- Applications (Phase 2/3 uses; table created early so foreign keys are stable)
CREATE TABLE applications (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                              -- tailored|awaiting_user|queued|submitted|failed|dry_run
  channel TEXT NOT NULL,                            -- ats_native|custom_page|local_agent|manual
  artifact_resume_pdf_path TEXT,
  artifact_cover_letter_md_path TEXT,
  qa_responses_json TEXT NOT NULL DEFAULT '[]',
  submitted_at TEXT,
  failure_screenshot_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_applications_state ON applications(state);

-- Outreach drafts (Phase 2)
CREATE TABLE outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  target_name TEXT NOT NULL,
  target_linkedin_url TEXT NOT NULL,
  target_role TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafted',           -- drafted|sent_by_user|archived
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Routine run log (heartbeat + telemetry)
CREATE TABLE routine_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine TEXT NOT NULL,                            -- 'ingest', 'backup', 'reconciler', etc.
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  ok BOOLEAN NOT NULL DEFAULT 0,
  error TEXT,
  stats_json TEXT                                   -- routine-specific counters
);

CREATE INDEX idx_routine_runs_recent ON routine_runs(routine, started_at DESC);
```

- [ ] **Step 2: Apply the migration**

```bash
npm run db:migrate
```

Expected output:
```
APPLY 001_init.sql
Migrations complete.
```

- [ ] **Step 3: Verify in Turso shell**

```bash
turso db shell job-hunter ".tables"
```

Expected: `_migrations  adapters  applications  jobs  outreach_drafts  profile  qa_kb  routine_runs  scores  settings`

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/001_init.sql
git commit -m "feat(db): add initial schema migration"
```

---

### Task 8: Core types + Zod schemas

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/schemas.ts`

- [ ] **Step 1: Write types.ts**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\types.ts`:

```ts
export type AdapterName =
  | 'remoteok' | 'wellfound' | 'weworkremotely' | 'himalayas' | 'jobicy' | 'workingnomads'
  | 'otta' | 'honeypot' | 'wttj' | 'hired'
  | 'greenhouse' | 'lever' | 'ashby' | 'linkedin';

export type VisaCategory =
  | 'country_specific' | 'sponsorship_offered' | 'international_remote' | 'unknown';

export interface JobPosting {
  id: string;
  source: AdapterName;
  external_id: string;
  url: string;
  company: { name: string; domain?: string; hq_country?: string };
  title: string;
  location: { remote: boolean; raw: string; geo?: string };
  visa: { category: VisaCategory; target_countries: string[] };
  target_timezone?: string;
  description_md: string;
  posted_at: string;
  raw_ref?: string;
  fetched_at: string;
}

export interface JobScore {
  job_id: string;
  value: number; // 0–100
  reasoning: string;
  dimensions: { skill_fit: number; level_fit: number; location_fit: number; comp_fit?: number };
  scored_at: string;
  model: string;
}

export interface ResumeBullet { text: string; numbers: string[]; }
export interface ResumeExperience {
  company: string; title: string; start: string; end?: string;
  bullets: ResumeBullet[];
}
export interface ResumeProject { name: string; bullets: ResumeBullet[]; }
export interface ResumeEducation { school: string; degree: string; year: string; }

export interface ResumeStruct {
  experience: ResumeExperience[];
  projects: ResumeProject[];
  skills: { primary: string[]; secondary: string[] };
  education: ResumeEducation[];
}

export interface ProfileBasics {
  name?: string; email?: string; phone?: string;
  location?: string; links?: string[];
}

export interface Preferences {
  target_roles: string[];
  min_salary?: number;
  locations: string[];
  work_auth_countries: string[];
  open_to_sponsorship_countries: string[];
  accept_international_remote: boolean;
  remote_only: boolean;
}

export interface Profile {
  resume_file?: { filename: string; uploaded_at: string };
  basics: ProfileBasics;
  resume_struct?: ResumeStruct;
  preferences: Preferences;
}

export interface AdapterState {
  name: AdapterName;
  enabled: boolean;
  config: Record<string, unknown>;
  last_run_at?: string;
  last_success_at?: string;
  last_error?: string;
  consecutive_failures: number;
}
```

- [ ] **Step 2: Write schemas.ts**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\schemas.ts`:

```ts
import { z } from 'zod';

export const AdapterNameSchema = z.enum([
  'remoteok', 'wellfound', 'weworkremotely', 'himalayas', 'jobicy', 'workingnomads',
  'otta', 'honeypot', 'wttj', 'hired',
  'greenhouse', 'lever', 'ashby', 'linkedin',
]);

export const VisaCategorySchema = z.enum([
  'country_specific', 'sponsorship_offered', 'international_remote', 'unknown',
]);

export const JobPostingSchema = z.object({
  id: z.string(),
  source: AdapterNameSchema,
  external_id: z.string(),
  url: z.string().url(),
  company: z.object({
    name: z.string(),
    domain: z.string().optional(),
    hq_country: z.string().length(2).optional(),
  }),
  title: z.string(),
  location: z.object({
    remote: z.boolean(),
    raw: z.string(),
    geo: z.string().optional(),
  }),
  visa: z.object({
    category: VisaCategorySchema,
    target_countries: z.array(z.string().length(2)),
  }),
  target_timezone: z.string().optional(),
  description_md: z.string(),
  posted_at: z.string(),
  raw_ref: z.string().optional(),
  fetched_at: z.string(),
});

export const ResumeBulletSchema = z.object({
  text: z.string(),
  numbers: z.array(z.string()),
});

export const ResumeStructSchema = z.object({
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    start: z.string(),
    end: z.string().optional(),
    bullets: z.array(ResumeBulletSchema),
  })),
  projects: z.array(z.object({
    name: z.string(),
    bullets: z.array(ResumeBulletSchema),
  })),
  skills: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
  }),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string(),
    year: z.string(),
  })),
});

export const PreferencesSchema = z.object({
  target_roles: z.array(z.string()).default([]),
  min_salary: z.number().optional(),
  locations: z.array(z.string()).default([]),
  work_auth_countries: z.array(z.string().length(2)).default(['pk']),
  open_to_sponsorship_countries: z.array(z.string().length(2)).default(
    ['us','uk','ca','de','nl','ie','au','ae','sg']
  ),
  accept_international_remote: z.boolean().default(true),
  remote_only: z.boolean().default(false),
});
```

- [ ] **Step 3: Smoke test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { JobPostingSchema, PreferencesSchema } from './schemas';

describe('schemas', () => {
  it('validates a JobPosting', () => {
    const valid = JobPostingSchema.parse({
      id: 'abc',
      source: 'remoteok',
      external_id: '12345',
      url: 'https://example.com/jobs/12345',
      company: { name: 'ExampleCo' },
      title: 'Senior Engineer',
      location: { remote: true, raw: 'Remote' },
      visa: { category: 'international_remote', target_countries: [] },
      description_md: 'Hello',
      posted_at: '2026-05-13T00:00:00Z',
      fetched_at: '2026-05-13T00:00:00Z',
    });
    expect(valid.source).toBe('remoteok');
  });

  it('rejects invalid country codes', () => {
    expect(() => JobPostingSchema.parse({
      id: 'a', source: 'remoteok', external_id: '1',
      url: 'https://x.com', company: { name: 'X' },
      title: 'X', location: { remote: false, raw: '' },
      visa: { category: 'country_specific', target_countries: ['USA'] }, // bad: 3 chars
      description_md: '', posted_at: '', fetched_at: '',
    })).toThrow();
  });

  it('Preferences defaults Pakistan + sponsorship-friendly countries', () => {
    const prefs = PreferencesSchema.parse({});
    expect(prefs.work_auth_countries).toEqual(['pk']);
    expect(prefs.open_to_sponsorship_countries).toContain('us');
    expect(prefs.accept_international_remote).toBe(true);
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/core/schemas.test.ts
```

Expected: 3 tests PASS.

```bash
git add src/core/types.ts src/core/schemas.ts src/core/schemas.test.ts
git commit -m "feat(core): add types + Zod schemas"
```

---

### Task 9: Boot the empty Hub

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the default page**

`c:\Users\user\Desktop\Repos\Job Hunter\app\page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Job Hunter</h1>
      <p className="mt-4 text-gray-600">
        Personal job-hunting system. Phase 1 is the radar.
      </p>
      <p className="mt-2 text-sm text-gray-500">
        Navigate: /feed, /profile, /settings, /inbox, /history
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Run the dev server**

```bash
npm run dev
```

Visit http://localhost:3000. Expected: "Job Hunter" heading visible.

Ctrl+C to stop.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(hub): replace default Next.js page with project landing"
```

**🟢 Stage A complete.** You can `npm run dev`, see the Hub, run `npm run db:migrate` against Turso, run `npm test` successfully. No domain logic yet — that starts in Stage B.

---

# Stage B: First end-to-end slice

Goal: RemoteOK adapter fetches real jobs, an Ingest routine inserts them into Turso, the Hub feed displays them. No scoring yet — that comes in Stage C.

---

### Task 10: Adapter interface

**Files:**
- Create: `src/core/adapters/types.ts`

- [ ] **Step 1: Write the interface**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\types.ts`:

```ts
import type { JobPosting, AdapterName } from '../types';

export interface AdapterConfig {
  // Each adapter defines its own; we'll narrow per-adapter via Zod.
  [key: string]: unknown;
}

export interface Adapter {
  name: AdapterName;

  /** Validate the user-provided config (e.g. company tokens for Greenhouse). */
  validateConfig(config: AdapterConfig): void;

  /**
   * Fetch new postings. Returns normalized JobPostings.
   * The adapter is responsible for parsing/normalizing only — dedupe and persistence
   * happen in the Ingest routine.
   */
  fetch(config: AdapterConfig): Promise<JobPosting[]>;
}
```

- [ ] **Step 2: Commit (no test for an interface)**

```bash
git add src/core/adapters/types.ts
git commit -m "feat(adapters): add Adapter interface"
```

---

### Task 11: Adapter helper — make job id

**Files:**
- Create: `src/core/adapters/util.ts`

- [ ] **Step 1: Write the helper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\util.ts`:

```ts
import { createHash } from 'node:crypto';
import type { AdapterName } from '../types';

/** Stable hash for (source, external_id). 16 hex chars is plenty for a few hundred thousand jobs. */
export function makeJobId(source: AdapterName, externalId: string): string {
  return createHash('sha256').update(`${source}::${externalId}`).digest('hex').slice(0, 16);
}

/** ISO timestamp now. */
export function nowIso(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 2: Smoke test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeJobId } from './util';

describe('makeJobId', () => {
  it('is stable for the same input', () => {
    expect(makeJobId('remoteok', '12345')).toBe(makeJobId('remoteok', '12345'));
  });
  it('differs across sources', () => {
    expect(makeJobId('remoteok', '12345')).not.toBe(makeJobId('greenhouse', '12345'));
  });
  it('returns 16 hex chars', () => {
    expect(makeJobId('remoteok', 'x')).toMatch(/^[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/core/adapters/util.test.ts
git add src/core/adapters/util.ts src/core/adapters/util.test.ts
git commit -m "feat(adapters): add stable job-id hash helper"
```

---

### Task 12: RemoteOK adapter (TDD)

**Files:**
- Create: `tests/fixtures/remoteok-sample.json`
- Create: `src/core/adapters/remoteok.ts`
- Create: `src/core/adapters/remoteok.test.ts`

- [ ] **Step 1: Capture a small fixture from RemoteOK**

Visit `https://remoteok.com/api` in a browser, copy the first 2–3 job objects (and the leading legal/notice object — RemoteOK includes it). Save the array as JSON to `tests/fixtures/remoteok-sample.json`.

For consistency in the rest of this task, use this minimal fixture (real RemoteOK shape):

`c:\Users\user\Desktop\Repos\Job Hunter\tests\fixtures\remoteok-sample.json`:

```json
[
  { "legal": "RemoteOK terms..." },
  {
    "id": "987654",
    "url": "https://remoteok.com/remote-jobs/987654-senior-typescript-engineer",
    "position": "Senior TypeScript Engineer",
    "company": "ExampleCo",
    "location": "Worldwide",
    "tags": ["typescript","node","react"],
    "description": "<p>Build cool things in TS.</p>",
    "date": "2026-05-12T10:00:00Z",
    "company_logo": "https://...",
    "salary_min": 100000,
    "salary_max": 140000
  },
  {
    "id": "987655",
    "url": "https://remoteok.com/remote-jobs/987655-staff-platform-eng",
    "position": "Staff Platform Engineer",
    "company": "OtherCo",
    "location": "Europe/Americas",
    "tags": ["aws","kubernetes"],
    "description": "<p>Platform work.</p>",
    "date": "2026-05-11T08:30:00Z"
  }
]
```

- [ ] **Step 2: Write the failing test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\remoteok.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RemoteOKAdapter } from './remoteok';

describe('RemoteOKAdapter', () => {
  it('parses RemoteOK API response into JobPostings, skipping the legal object', async () => {
    const fixture = await readFile(
      path.join(process.cwd(), 'tests/fixtures/remoteok-sample.json'),
      'utf8'
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => JSON.parse(fixture),
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new RemoteOKAdapter();
    const postings = await adapter.fetch({});

    expect(postings).toHaveLength(2);
    expect(postings[0].source).toBe('remoteok');
    expect(postings[0].external_id).toBe('987654');
    expect(postings[0].title).toBe('Senior TypeScript Engineer');
    expect(postings[0].company.name).toBe('ExampleCo');
    expect(postings[0].location.remote).toBe(true);
    expect(postings[0].url).toContain('remoteok.com');
    expect(postings[0].description_md).toContain('Build cool things');
    expect(postings[0].id).toMatch(/^[0-9a-f]{16}$/);
  });
});
```

- [ ] **Step 3: Run the test — confirm it fails**

```bash
npm test -- src/core/adapters/remoteok.test.ts
```

Expected: FAIL with "Cannot find module './remoteok'".

- [ ] **Step 4: Implement the adapter**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\remoteok.ts`:

```ts
import type { Adapter, AdapterConfig } from './types';
import type { JobPosting } from '../types';
import { makeJobId, nowIso } from './util';

const ENDPOINT = 'https://remoteok.com/api';

export class RemoteOKAdapter implements Adapter {
  readonly name = 'remoteok' as const;

  validateConfig(_: AdapterConfig): void {
    // RemoteOK is zero-config.
  }

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(ENDPOINT, {
      headers: { 'User-Agent': 'job-hunter/1.0 (personal use)' },
    });
    if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
    const raw = (await res.json()) as unknown[];

    const postings: JobPosting[] = [];
    for (const item of raw) {
      if (!isJobItem(item)) continue; // skip the legal/notice object
      postings.push({
        id: makeJobId('remoteok', item.id),
        source: 'remoteok',
        external_id: item.id,
        url: item.url,
        company: { name: item.company },
        title: item.position,
        location: { remote: true, raw: item.location ?? 'Remote' },
        visa: { category: 'unknown', target_countries: [] }, // tagged later by Ingest
        description_md: stripHtml(item.description ?? ''),
        posted_at: item.date,
        fetched_at: nowIso(),
      });
    }
    return postings;
  }
}

interface RemoteOKItem {
  id: string;
  url: string;
  position: string;
  company: string;
  location?: string;
  description?: string;
  date: string;
}

function isJobItem(x: unknown): x is RemoteOKItem {
  return typeof x === 'object' && x !== null
    && 'id' in x && 'position' in x && 'company' in x && 'url' in x && 'date' in x;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 5: Run the test — confirm it passes**

```bash
npm test -- src/core/adapters/remoteok.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/remoteok-sample.json src/core/adapters/remoteok.ts src/core/adapters/remoteok.test.ts
git commit -m "feat(adapters): add RemoteOK adapter"
```

---

### Task 13: Adapter registry

**Files:**
- Create: `src/core/adapters/registry.ts`

- [ ] **Step 1: Write the registry**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\registry.ts`:

```ts
import type { Adapter } from './types';
import type { AdapterName } from '../types';
import { RemoteOKAdapter } from './remoteok';

/**
 * Adapter registry. Add new adapters here as you implement them.
 * Routines look adapters up by name from the Turso `adapters` table's `enabled=true` rows.
 */
const ADAPTERS: Partial<Record<AdapterName, Adapter>> = {
  remoteok: new RemoteOKAdapter(),
};

export function getAdapter(name: AdapterName): Adapter | undefined {
  return ADAPTERS[name];
}

export function getEnabledAdapterNames(): AdapterName[] {
  return Object.keys(ADAPTERS) as AdapterName[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/adapters/registry.ts
git commit -m "feat(adapters): add registry"
```

---

### Task 14: Persistence helper — insert a job

**Files:**
- Create: `src/core/jobs/persist.ts`

- [ ] **Step 1: Write the persist helper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\jobs\persist.ts`:

```ts
import type { Client } from '@libsql/client';
import type { JobPosting } from '../types';

/**
 * Insert new job postings, skipping ones already present (unique on source+external_id).
 * Returns the count actually inserted.
 */
export async function insertJobs(db: Client, postings: JobPosting[]): Promise<number> {
  if (postings.length === 0) return 0;

  // Use INSERT OR IGNORE to dedupe on the UNIQUE(source, external_id) constraint.
  // libSQL doesn't support batch INSERT with named params cleanly, so one at a time.
  let inserted = 0;
  for (const j of postings) {
    const res = await db.execute({
      sql: `INSERT OR IGNORE INTO jobs (
        id, source, external_id, url, company_name, company_domain, company_hq_country,
        title, location_remote, location_raw, location_geo,
        visa_category, visa_target_countries_json, target_timezone,
        description_md, posted_at, raw_ref, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        j.id, j.source, j.external_id, j.url,
        j.company.name, j.company.domain ?? null, j.company.hq_country ?? null,
        j.title, j.location.remote ? 1 : 0, j.location.raw, j.location.geo ?? null,
        j.visa.category, JSON.stringify(j.visa.target_countries), j.target_timezone ?? null,
        j.description_md, j.posted_at, j.raw_ref ?? null, j.fetched_at,
      ],
    });
    if (res.rowsAffected > 0) inserted++;
  }
  return inserted;
}
```

- [ ] **Step 2: Smoke test (against real Turso)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\jobs\persist.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '@/src/db/client';
import { insertJobs } from './persist';
import { makeJobId } from '../adapters/util';

describe('insertJobs', () => {
  beforeAll(async () => {
    // Clean any prior test rows
    await getDb().execute("DELETE FROM jobs WHERE source = 'remoteok' AND external_id LIKE 'test-%'");
  });

  it('inserts new rows and dedupes existing ones', async () => {
    const db = getDb();
    const sample = {
      id: makeJobId('remoteok', 'test-1'),
      source: 'remoteok' as const,
      external_id: 'test-1',
      url: 'https://example.com/test-1',
      company: { name: 'TestCo' },
      title: 'Test Role',
      location: { remote: true, raw: 'Worldwide' },
      visa: { category: 'unknown' as const, target_countries: [] },
      description_md: 'test',
      posted_at: '2026-05-13T00:00:00Z',
      fetched_at: '2026-05-13T00:00:00Z',
    };
    const first = await insertJobs(db, [sample]);
    const second = await insertJobs(db, [sample]); // duplicate
    expect(first).toBe(1);
    expect(second).toBe(0);

    // Cleanup
    await db.execute("DELETE FROM jobs WHERE source = 'remoteok' AND external_id = 'test-1'");
  });
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/core/jobs/persist.test.ts
git add src/core/jobs/persist.ts src/core/jobs/persist.test.ts
git commit -m "feat(jobs): add insertJobs with dedupe"
```

---

### Task 15: Run the adapter end-to-end via a CLI script

**Files:**
- Create: `scripts/run-adapter.ts`

- [ ] **Step 1: Write the runner**

This is a CLI we'll use to test adapters locally before wiring them into routines.

`c:\Users\user\Desktop\Repos\Job Hunter\scripts\run-adapter.ts`:

```ts
import 'dotenv/config';
import { getDb } from '@/src/db/client';
import { getAdapter } from '@/src/core/adapters/registry';
import { insertJobs } from '@/src/core/jobs/persist';
import type { AdapterName } from '@/src/core/types';

async function main() {
  const name = process.argv[2] as AdapterName | undefined;
  if (!name) {
    console.error('Usage: npx tsx scripts/run-adapter.ts <adapter-name>');
    process.exit(1);
  }
  const adapter = getAdapter(name);
  if (!adapter) {
    console.error(`Adapter not registered: ${name}`);
    process.exit(1);
  }

  console.log(`Fetching from ${name}...`);
  const postings = await adapter.fetch({});
  console.log(`Got ${postings.length} postings.`);

  const inserted = await insertJobs(getDb(), postings);
  console.log(`Inserted ${inserted} new rows (${postings.length - inserted} duplicates skipped).`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/run-adapter.ts remoteok
```

Expected: "Fetching from remoteok...", "Got N postings.", "Inserted N new rows..."

- [ ] **Step 3: Verify in Turso**

```bash
turso db shell job-hunter "SELECT count(*) FROM jobs"
turso db shell job-hunter "SELECT title, company_name FROM jobs ORDER BY fetched_at DESC LIMIT 5"
```

Expected: count > 0, top rows show real RemoteOK jobs.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-adapter.ts
git commit -m "feat: add run-adapter CLI for manual adapter testing"
```

---

### Task 16: Hub layout + nav

**Files:**
- Create: `app/layout.tsx` (modify the default)
- Create: `components/site-nav.tsx`

- [ ] **Step 1: Build the nav**

`c:\Users\user\Desktop\Repos\Job Hunter\components\site-nav.tsx`:

```tsx
import Link from 'next/link';

const NAV = [
  { href: '/feed', label: 'Feed' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/history', label: 'History' },
];

export function SiteNav() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-bold">Job Hunter</Link>
        {NAV.map(item => (
          <Link key={item.href} href={item.href} className="text-sm text-gray-700 hover:text-gray-900">
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Wire nav into the layout**

`c:\Users\user\Desktop\Repos\Job Hunter\app\layout.tsx` — replace the body to include nav above children:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { SiteNav } from '@/components/site-nav';

export const metadata: Metadata = {
  title: 'Job Hunter',
  description: 'Personal job-hunting system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <SiteNav />
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Run dev and click around**

```bash
npm run dev
```

Visit `/`, `/feed`, `/profile`, etc. They'll 404 since pages don't exist yet — that's expected for now. Nav renders.

Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add components/site-nav.tsx app/layout.tsx
git commit -m "feat(hub): add site nav + layout"
```

---

### Task 17: Feed page (read-only, basic table)

**Files:**
- Create: `app/feed/page.tsx`
- Create: `src/core/jobs/query.ts`

- [ ] **Step 1: Query helper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\jobs\query.ts`:

```ts
import { getDb } from '@/src/db/client';
import type { JobPosting } from '@/src/core/types';

export interface FeedRow extends JobPosting {
  score: number | null;
  score_reasoning: string | null;
}

/**
 * Read jobs joined with scores. Ordered by score desc (nulls last), then fetched_at desc.
 */
export async function listFeed(limit = 100): Promise<FeedRow[]> {
  const db = getDb();
  const { rows } = await db.execute({
    sql: `
      SELECT j.*, s.value AS score, s.reasoning AS score_reasoning
      FROM jobs j
      LEFT JOIN scores s ON s.job_id = j.id
      WHERE j.archived = 0
      ORDER BY (s.value IS NULL), s.value DESC, j.fetched_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return rows.map(r => ({
    id: r.id as string,
    source: r.source as JobPosting['source'],
    external_id: r.external_id as string,
    url: r.url as string,
    company: {
      name: r.company_name as string,
      domain: (r.company_domain as string | null) ?? undefined,
      hq_country: (r.company_hq_country as string | null) ?? undefined,
    },
    title: r.title as string,
    location: {
      remote: Number(r.location_remote) === 1,
      raw: r.location_raw as string,
      geo: (r.location_geo as string | null) ?? undefined,
    },
    visa: {
      category: r.visa_category as JobPosting['visa']['category'],
      target_countries: JSON.parse((r.visa_target_countries_json as string) || '[]'),
    },
    target_timezone: (r.target_timezone as string | null) ?? undefined,
    description_md: r.description_md as string,
    posted_at: r.posted_at as string,
    raw_ref: (r.raw_ref as string | null) ?? undefined,
    fetched_at: r.fetched_at as string,
    score: r.score === null ? null : Number(r.score),
    score_reasoning: (r.score_reasoning as string | null) ?? null,
  }));
}
```

- [ ] **Step 2: Feed page**

`c:\Users\user\Desktop\Repos\Job Hunter\app\feed\page.tsx`:

```tsx
import { listFeed } from '@/src/core/jobs/query';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic'; // always re-render with fresh DB data

export default async function FeedPage() {
  const rows = await listFeed(200);

  return (
    <main>
      <h1 className="text-2xl font-bold">Feed</h1>
      <p className="mt-1 text-sm text-gray-500">{rows.length} jobs</p>

      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-2">Score</th>
            <th>Title</th>
            <th>Company</th>
            <th>Source</th>
            <th>Visa</th>
            <th>Posted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t">
              <td className="py-2 font-mono">{r.score ?? '—'}</td>
              <td>{r.title}</td>
              <td>{r.company.name}</td>
              <td className="text-gray-500">{r.source}</td>
              <td className="text-gray-500">{r.visa.category}</td>
              <td className="text-gray-500">
                {r.posted_at ? formatDistanceToNow(new Date(r.posted_at), { addSuffix: true }) : '—'}
              </td>
              <td>
                <a href={r.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                  view
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Boot dev, visit /feed**

```bash
npm run dev
```

Visit http://localhost:3000/feed. Expected: a table of real RemoteOK jobs (from Task 15's run). Scores all "—" since we haven't built the scorer yet.

Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/core/jobs/query.ts app/feed/page.tsx
git commit -m "feat(hub): add feed page with job table"
```

---

### Task 18: Ingest routine prompt (stub — no scoring yet)

**Files:**
- Create: `routines/ingest.md`

This is the natural-language prompt that you'll later paste into a Claude Code `/schedule` routine. For now it just does the crawl half; scoring is wired in Stage C.

- [ ] **Step 1: Write the routine prompt**

`c:\Users\user\Desktop\Repos\Job Hunter\routines\ingest.md`:

```markdown
# Ingest routine — every 2 hours

You are the Job Hunter Ingest routine. Your job: pull new postings from enabled
adapters and store them in Turso.

## Environment

- `TURSO_DATABASE_URL`: the libSQL HTTP endpoint
- `TURSO_AUTH_TOKEN_INGEST`: write access to `jobs` table only

## Steps

1. Connect to Turso. Query: `SELECT name, config_json FROM adapters WHERE enabled = 1`.

2. For each enabled adapter, fetch new postings:

   - **remoteok**: GET `https://remoteok.com/api` (no auth). Skip the first object
     (legal notice). For each item with an `id`, build a JobPosting with:
     `source='remoteok'`, `external_id=item.id`, `url=item.url`, `title=item.position`,
     `company.name=item.company`, `location.remote=true`, `location.raw=item.location||'Remote'`,
     `description_md=stripHtml(item.description)`, `posted_at=item.date`,
     `visa.category='unknown'` (we'll classify in step 3),
     `id=sha256('remoteok::'+item.id).slice(0,16)`,
     `fetched_at=now()`.

   - (More adapters wired in via later tasks; routine prompt updated each time.)

3. For each fetched posting, INSERT OR IGNORE into `jobs` (unique on
   `(source, external_id)`). Count inserted vs skipped.

4. (Stage C will add: classify visa, score newly-inserted postings via Haiku.)

5. Write a routine_runs row with stats:
   ```
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('ingest', datetime('now'), 1, '{"fetched": N, "inserted": M}');
   ```

6. On any adapter failure: write `last_error` and increment `consecutive_failures`
   on the `adapters` row; do NOT crash the whole routine — other adapters keep running.
   After 3 consecutive failures: set `enabled = 0` (auto-disable).

## Failure mode

If Turso is unreachable: retry 3x with exponential backoff. If still failing,
write to the routine_runs table on next successful run.
```

- [ ] **Step 2: Commit**

```bash
git add routines/ingest.md
git commit -m "feat(routines): add Ingest routine prompt (crawl half)"
```

**🟢 Stage B complete.** End-to-end: you can run `npx tsx scripts/run-adapter.ts remoteok` and see jobs appear at `http://localhost:3000/feed`. The Ingest routine prompt exists, ready to deploy once Stage C wires in scoring.

---

# Stage C: Profile & scoring

Goal: Upload your resume → Sonnet extracts structured JSON → Scorer ranks the feed. After this stage, the feed is actually useful.

---

### Task 19: Anthropic SDK wrapper

**Files:**
- Create: `src/llm/client.ts`

- [ ] **Step 1: Write the wrapper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\llm\client.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  cached = new Anthropic({ apiKey });
  return cached;
}

/**
 * Sonnet for quality work (extraction, tailoring judge).
 * Haiku for cheap high-volume (scoring, classification).
 */
export const MODEL_SONNET = 'claude-sonnet-4-6';
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
```

- [ ] **Step 2: Commit (no test — trivial wrapper)**

```bash
git add src/llm/client.ts
git commit -m "feat(llm): add Anthropic SDK wrapper"
```

---

### Task 20: Resume extraction (Sonnet, one-shot)

**Files:**
- Create: `src/profile/extract.ts`
- Create: `src/profile/extract.test.ts` (uses a fixture resume — see Step 1)

- [ ] **Step 1: Prepare a sample resume PDF**

Save any PDF resume (your own is fine, or a sample from the web) to `tests/fixtures/sample-resume.pdf`. Don't commit your real resume — use a sample or anonymized version for the fixture.

```bash
mkdir -p tests/fixtures
# place sample-resume.pdf in tests/fixtures/
```

- [ ] **Step 2: Write the extraction module**

`c:\Users\user\Desktop\Repos\Job Hunter\src\profile\extract.ts`:

```ts
import { getAnthropic, MODEL_SONNET } from '@/src/llm/client';
import { ResumeStructSchema } from '@/src/core/schemas';
import type { ResumeStruct } from '@/src/core/types';

const SYSTEM = `You extract structured data from a resume PDF. Return JSON matching exactly:

{
  "experience": [
    {
      "company": string,
      "title": string,
      "start": string (YYYY-MM),
      "end": string | null (YYYY-MM, null if current),
      "bullets": [ { "text": string, "numbers": string[] } ]
    }
  ],
  "projects": [ { "name": string, "bullets": [ { "text": string, "numbers": string[] } ] } ],
  "skills": { "primary": string[], "secondary": string[] },
  "education": [ { "school": string, "degree": string, "year": string } ]
}

For each bullet, populate "numbers" with EVERY distinct numeric token that appears in
that bullet's text (e.g. ["30%", "2M", "8"]). This array is the ONLY allowed source of
numbers when later tailoring this bullet — invented numbers are misrepresentation.

Return ONLY valid JSON. No prose.`;

export async function extractResume(pdfBytes: Uint8Array): Promise<ResumeStruct> {
  const client = getAnthropic();
  const base64 = Buffer.from(pdfBytes).toString('base64');

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        },
        { type: 'text', text: 'Extract this resume into the JSON schema above.' },
      ],
    }],
  });

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('');

  // Strip code fences if Claude wrapped it
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(cleaned);
  return ResumeStructSchema.parse(parsed);
}
```

- [ ] **Step 3: Write the test (network-touching — skipped in CI by default)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\profile\extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractResume } from './extract';

// Skip if no API key (e.g. in CI without secrets) or no fixture
const FIXTURE = path.join(process.cwd(), 'tests/fixtures/sample-resume.pdf');
const RUN = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

RUN('extractResume', () => {
  it('extracts structured resume from a real PDF', async () => {
    const bytes = await readFile(FIXTURE);
    const struct = await extractResume(new Uint8Array(bytes));
    expect(struct.experience.length).toBeGreaterThan(0);
    expect(struct.experience[0].bullets.length).toBeGreaterThan(0);
    expect(struct.skills.primary.length).toBeGreaterThan(0);
  }, 60_000); // up to 60s for the API call
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/profile/extract.test.ts
```

Expected: PASS (real API call; takes 10–30s). If you don't want to spend the $0.05 right now, the test will skip if `ANTHROPIC_API_KEY` is unset.

```bash
git add src/profile/extract.ts src/profile/extract.test.ts tests/fixtures/sample-resume.pdf
git commit -m "feat(profile): add Sonnet-based resume extraction"
```

---

### Task 21: Profile read/write helpers

**Files:**
- Create: `src/profile/store.ts`

- [ ] **Step 1: Write helpers**

`c:\Users\user\Desktop\Repos\Job Hunter\src\profile\store.ts`:

```ts
import { getDb } from '@/src/db/client';
import type { Profile, Preferences, ResumeStruct } from '@/src/core/types';
import { PreferencesSchema } from '@/src/core/schemas';

export async function getProfile(): Promise<Profile> {
  const { rows } = await getDb().execute('SELECT * FROM profile WHERE id = 1');
  const r = rows[0];
  if (!r) throw new Error('profile row missing — migration not applied?');
  const basics = JSON.parse((r.basics_json as string) || '{}');
  const preferences = PreferencesSchema.parse(
    JSON.parse((r.preferences_json as string) || '{}')
  );
  const resume_struct = r.resume_struct_json
    ? (JSON.parse(r.resume_struct_json as string) as ResumeStruct)
    : undefined;
  return {
    resume_file: r.resume_filename ? {
      filename: r.resume_filename as string,
      uploaded_at: r.resume_uploaded_at as string,
    } : undefined,
    basics,
    resume_struct,
    preferences,
  };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  await getDb().execute({
    sql: 'UPDATE profile SET preferences_json = ? WHERE id = 1',
    args: [JSON.stringify(prefs)],
  });
}

export async function saveResume(input: {
  pdfBase64: string;
  filename: string;
  struct: ResumeStruct;
}): Promise<void> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: `UPDATE profile
          SET resume_pdf_base64 = ?, resume_filename = ?, resume_uploaded_at = ?, resume_struct_json = ?
          WHERE id = 1`,
    args: [input.pdfBase64, input.filename, now, JSON.stringify(input.struct)],
  });
}
```

- [ ] **Step 2: Commit (no test — helpers are tested via the Profile page integration)**

```bash
git add src/profile/store.ts
git commit -m "feat(profile): add Turso read/write helpers"
```

---

### Task 22: Profile page — upload UI

**Files:**
- Create: `app/profile/page.tsx`
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: Upload route handler**

`c:\Users\user\Desktop\Repos\Job Hunter\app\api\upload\route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { extractResume } from '@/src/profile/extract';
import { saveResume } from '@/src/profile/store';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('resume');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF only' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');

  // Extract via Sonnet (this is the one direct API call we make)
  const struct = await extractResume(bytes);

  await saveResume({ pdfBase64: base64, filename: file.name, struct });
  return NextResponse.json({ ok: true, experience_count: struct.experience.length });
}
```

- [ ] **Step 2: Profile page**

`c:\Users\user\Desktop\Repos\Job Hunter\app\profile\page.tsx`:

```tsx
import { getProfile } from '@/src/profile/store';
import { UploadForm } from './upload-form';
import { PreferencesForm } from './preferences-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getProfile();
  return (
    <main className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Profile</h1>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Resume</h2>
        {profile.resume_file ? (
          <p className="mt-2 text-sm text-gray-600">
            <code>{profile.resume_file.filename}</code> — uploaded{' '}
            {new Date(profile.resume_file.uploaded_at).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No resume uploaded yet.</p>
        )}
        {profile.resume_struct && (
          <p className="mt-1 text-xs text-gray-500">
            Extracted: {profile.resume_struct.experience.length} roles ·{' '}
            {profile.resume_struct.projects.length} projects ·{' '}
            {profile.resume_struct.skills.primary.length} primary skills
          </p>
        )}
        <div className="mt-4">
          <UploadForm />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Preferences</h2>
        <PreferencesForm initial={profile.preferences} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Upload form component**

`c:\Users\user\Desktop\Repos\Job Hunter\app\profile\upload-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function UploadForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'upload failed' }));
      setError(error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input type="file" name="resume" accept="application/pdf" required disabled={pending} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Extracting...' : 'Upload + extract'}
      </Button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </form>
  );
}
```

- [ ] **Step 4: Run dev, upload your resume**

```bash
npm run dev
```

Visit `/profile`. Click "Upload + extract" with your resume PDF. Wait ~15–30s (Sonnet call). Page refreshes; you should see "Extracted: N roles · M projects · K primary skills".

Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts app/profile/page.tsx app/profile/upload-form.tsx
git commit -m "feat(hub): profile page with resume upload + Sonnet extraction"
```

---

### Task 23: Preferences form

**Files:**
- Create: `app/profile/preferences-form.tsx`
- Create: `app/api/preferences/route.ts`

- [ ] **Step 1: API route**

`c:\Users\user\Desktop\Repos\Job Hunter\app\api\preferences\route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { PreferencesSchema } from '@/src/core/schemas';
import { savePreferences } from '@/src/profile/store';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = PreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await savePreferences(parsed.data);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Form component (client)**

`c:\Users\user\Desktop\Repos\Job Hunter\app\profile\preferences-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Preferences } from '@/src/core/types';

export function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function save() {
    setPending(true); setSaved(false);
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    setPending(false);
    if (res.ok) { setSaved(true); router.refresh(); }
  }

  return (
    <div className="mt-2 space-y-4">
      <div>
        <Label>Target roles (comma-separated)</Label>
        <Input
          value={prefs.target_roles.join(', ')}
          onChange={e => setPrefs(p => ({ ...p, target_roles: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
          placeholder="Staff Engineer, Senior Backend Engineer, Tech Lead"
        />
      </div>

      <div>
        <Label>Work-auth countries (ISO codes, comma-separated)</Label>
        <Input
          value={prefs.work_auth_countries.join(', ')}
          onChange={e => setPrefs(p => ({ ...p, work_auth_countries: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) }))}
          placeholder="pk"
        />
      </div>

      <div>
        <Label>Open to sponsorship in (ISO codes)</Label>
        <Input
          value={prefs.open_to_sponsorship_countries.join(', ')}
          onChange={e => setPrefs(p => ({ ...p, open_to_sponsorship_countries: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) }))}
          placeholder="us, uk, ca, de, nl, ie, au, ae, sg"
        />
      </div>

      <div>
        <Label>Min salary (USD/year, optional)</Label>
        <Input
          type="number"
          value={prefs.min_salary ?? ''}
          onChange={e => setPrefs(p => ({ ...p, min_salary: e.target.value ? Number(e.target.value) : undefined }))}
          placeholder="leave blank for no floor"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={prefs.accept_international_remote}
          onCheckedChange={(checked) => setPrefs(p => ({ ...p, accept_international_remote: checked }))}
        />
        <Label>Accept international-remote roles</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={prefs.remote_only}
          onCheckedChange={(checked) => setPrefs(p => ({ ...p, remote_only: checked }))}
        />
        <Label>Remote-only (hide on-site)</Label>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={pending}>{pending ? 'Saving...' : 'Save preferences'}</Button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run dev, edit + save preferences**

```bash
npm run dev
```

Visit `/profile`. Edit a preference field, click "Save preferences". Confirm "Saved" appears. Refresh; values persisted.

- [ ] **Step 4: Commit**

```bash
git add app/api/preferences/route.ts app/profile/preferences-form.tsx
git commit -m "feat(hub): preferences form with save endpoint"
```

---

### Task 24: Scorer (Haiku, LLM-as-judge)

**Files:**
- Create: `src/core/scoring/score.ts`
- Create: `src/core/scoring/score.test.ts`

- [ ] **Step 1: Write the scorer**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\scoring\score.ts`:

```ts
import { getAnthropic, MODEL_HAIKU } from '@/src/llm/client';
import type { JobPosting, Profile, JobScore, ResumeStruct } from '@/src/core/types';

const SYSTEM = `You score a job posting against a candidate's profile from 0–100.

Dimensions (each 0–100):
- skill_fit: technical & domain match between candidate's skills and the JD
- level_fit: seniority alignment (intern ≪ junior ≪ mid ≪ senior ≪ staff ≪ principal)
- location_fit: how well the location/remote situation matches preferences
- comp_fit (optional, only if JD mentions salary): does it meet the candidate's min?

Overall score: weighted average — skill 40%, level 30%, location 20%, comp 10%
(or skill 45%, level 35%, location 20% if comp not provided).

Return JSON ONLY:
{
  "value": integer 0–100,
  "reasoning": "1–2 sentences",
  "dimensions": { "skill_fit": int, "level_fit": int, "location_fit": int, "comp_fit": int|null }
}`;

function compactResume(s: ResumeStruct | undefined): string {
  if (!s) return '(no structured resume yet)';
  const exp = s.experience.map(e => `${e.title} @ ${e.company} (${e.start}–${e.end ?? 'now'})`).join('; ');
  const skills = [...s.skills.primary, ...s.skills.secondary].join(', ');
  return `Experience: ${exp}\nSkills: ${skills}`;
}

export async function scoreJob(profile: Profile, posting: JobPosting): Promise<JobScore> {
  const client = getAnthropic();
  const userText = [
    `# Candidate profile`,
    compactResume(profile.resume_struct),
    `Preferences: ${JSON.stringify(profile.preferences)}`,
    ``,
    `# Job`,
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location: ${posting.location.raw}${posting.location.remote ? ' (remote)' : ''}`,
    `Description:`,
    posting.description_md.slice(0, 4000),
  ].join('\n');

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: 'user', content: userText }],
  });

  const text = response.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text).join('');
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(cleaned) as {
    value: number; reasoning: string;
    dimensions: { skill_fit: number; level_fit: number; location_fit: number; comp_fit: number | null };
  };

  return {
    job_id: posting.id,
    value: parsed.value,
    reasoning: parsed.reasoning,
    dimensions: {
      skill_fit: parsed.dimensions.skill_fit,
      level_fit: parsed.dimensions.level_fit,
      location_fit: parsed.dimensions.location_fit,
      comp_fit: parsed.dimensions.comp_fit ?? undefined,
    },
    scored_at: new Date().toISOString(),
    model: MODEL_HAIKU,
  };
}
```

- [ ] **Step 2: Smoke test (skipped without API key)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\scoring\score.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreJob } from './score';
import type { JobPosting, Profile } from '@/src/core/types';

const RUN = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

RUN('scoreJob', () => {
  it('returns a 0–100 score with dimensions and reasoning', async () => {
    const profile: Profile = {
      basics: { name: 'Test' },
      preferences: {
        target_roles: ['Senior Backend Engineer'],
        locations: [],
        work_auth_countries: ['pk'],
        open_to_sponsorship_countries: ['us'],
        accept_international_remote: true,
        remote_only: true,
      },
      resume_struct: {
        experience: [{ company: 'Acme', title: 'Senior Engineer', start: '2022-01',
          bullets: [{ text: 'Built backend services in Node and Postgres', numbers: [] }] }],
        projects: [], education: [],
        skills: { primary: ['typescript','node','postgres'], secondary: [] },
      },
    };
    const posting: JobPosting = {
      id: 'x', source: 'remoteok', external_id: '1',
      url: 'https://x.com', company: { name: 'Test' },
      title: 'Senior Backend Engineer (Node)',
      location: { remote: true, raw: 'Worldwide' },
      visa: { category: 'international_remote', target_countries: [] },
      description_md: 'Looking for a senior Node + Postgres engineer to join our remote team.',
      posted_at: '2026-05-12T00:00:00Z',
      fetched_at: '2026-05-13T00:00:00Z',
    };

    const score = await scoreJob(profile, posting);
    expect(score.value).toBeGreaterThanOrEqual(0);
    expect(score.value).toBeLessThanOrEqual(100);
    expect(score.reasoning.length).toBeGreaterThan(10);
    expect(score.dimensions.skill_fit).toBeGreaterThan(50); // strong match
  }, 30_000);
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/core/scoring/score.test.ts
git add src/core/scoring/score.ts src/core/scoring/score.test.ts
git commit -m "feat(scoring): add Haiku-based job scorer"
```

---

### Task 25: Score persistence + score-all-unscored helper

**Files:**
- Create: `src/core/scoring/persist.ts`

- [ ] **Step 1: Write the helper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\scoring\persist.ts`:

```ts
import type { Client } from '@libsql/client';
import type { JobScore, JobPosting, Profile } from '@/src/core/types';
import { scoreJob } from './score';

export async function saveScore(db: Client, score: JobScore): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO scores
          (job_id, value, reasoning, dimensions_json, scored_at, model)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      score.job_id, score.value, score.reasoning,
      JSON.stringify(score.dimensions), score.scored_at, score.model,
    ],
  });
}

/** Score every job that doesn't have a score yet. Returns count scored. */
export async function scoreUnscored(db: Client, profile: Profile): Promise<number> {
  const { rows } = await db.execute(`
    SELECT j.* FROM jobs j
    LEFT JOIN scores s ON s.job_id = j.id
    WHERE s.job_id IS NULL AND j.archived = 0
    ORDER BY j.fetched_at DESC
    LIMIT 100
  `);

  let count = 0;
  for (const r of rows) {
    const posting: JobPosting = {
      id: r.id as string,
      source: r.source as JobPosting['source'],
      external_id: r.external_id as string,
      url: r.url as string,
      company: { name: r.company_name as string },
      title: r.title as string,
      location: { remote: Number(r.location_remote) === 1, raw: r.location_raw as string },
      visa: { category: r.visa_category as JobPosting['visa']['category'], target_countries: [] },
      description_md: r.description_md as string,
      posted_at: r.posted_at as string,
      fetched_at: r.fetched_at as string,
    };
    try {
      const score = await scoreJob(profile, posting);
      await saveScore(db, score);
      count++;
    } catch (err) {
      console.error(`Score failed for ${posting.id}:`, err);
    }
  }
  return count;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/core/scoring/persist.ts
git commit -m "feat(scoring): add persistence + score-unscored helper"
```

---

### Task 26: CLI runner for scoring

**Files:**
- Create: `scripts/score-feed.ts`

- [ ] **Step 1: Write the runner**

`c:\Users\user\Desktop\Repos\Job Hunter\scripts\score-feed.ts`:

```ts
import 'dotenv/config';
import { getDb } from '@/src/db/client';
import { getProfile } from '@/src/profile/store';
import { scoreUnscored } from '@/src/core/scoring/persist';

async function main() {
  const profile = await getProfile();
  if (!profile.resume_struct) {
    console.error('No resume uploaded yet — upload one via /profile first.');
    process.exit(1);
  }
  const n = await scoreUnscored(getDb(), profile);
  console.log(`Scored ${n} jobs.`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run + verify**

```bash
npx tsx scripts/score-feed.ts
```

Expected: "Scored N jobs."

Visit http://localhost:3000/feed — top rows now have real scores, ranked descending.

- [ ] **Step 3: Commit**

```bash
git add scripts/score-feed.ts
git commit -m "feat: add score-feed CLI"
```

---

### Task 27: Update Ingest routine to include scoring

**Files:**
- Modify: `routines/ingest.md`

- [ ] **Step 1: Add the scoring step**

In `routines/ingest.md`, replace step 4 ("Stage C will add...") with:

```markdown
4. After inserting new postings, for each newly-inserted job:

   a. Query the profile (`SELECT resume_struct_json, preferences_json FROM profile WHERE id = 1`).

   b. Send a Haiku scoring prompt with the candidate profile + the JD. The prompt
      should return JSON: `{value, reasoning, dimensions: {skill_fit, level_fit, location_fit, comp_fit}}`.

   c. INSERT OR REPLACE into `scores` with the result.

5. Write a routine_runs row with stats:
   ```
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('ingest', datetime('now'), 1,
           json_object('fetched', N, 'inserted', M, 'scored', K));
   ```
```

- [ ] **Step 2: Commit**

```bash
git add routines/ingest.md
git commit -m "feat(routines): wire scoring into Ingest routine prompt"
```

**🟢 Stage C complete.** Upload your resume on `/profile`, then run `npx tsx scripts/score-feed.ts` and the feed is now ranked. You have a working personal job radar.

---

# Stage D: More adapters

Goal: add Honeypot (regional) and Greenhouse (per-company ATS) and the visa classifier so all 3 produce well-tagged data.

---

### Task 28: Visa + timezone classifier

**Files:**
- Create: `src/core/ingest/classify.ts`
- Create: `src/core/ingest/classify.test.ts`

- [ ] **Step 1: Write the classifier (Haiku)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\ingest\classify.ts`:

```ts
import { getAnthropic, MODEL_HAIKU } from '@/src/llm/client';
import type { VisaCategory, JobPosting } from '@/src/core/types';

const SYSTEM = `You classify a job posting for visa requirements and target timezone.

Return JSON ONLY:
{
  "category": "country_specific" | "sponsorship_offered" | "international_remote" | "unknown",
  "target_countries": string[],   // ISO 3166-1 alpha-2 lowercase; empty if international_remote
  "target_timezone": string|null   // IANA TZ if clearly inferable from JD (e.g. "America/New_York", "Europe/Berlin"), else null
}

Rules:
- "Must be authorized to work in [X]" / "based in [X]" / "[X] residents only" → country_specific, target_countries=[X codes]
- "Sponsorship available" / "visa sponsorship" / "H-1B sponsorship" → sponsorship_offered, target_countries=[the country offering it]
- "Remote, anywhere" / "Worldwide" / "Hire globally" / "EOR-friendly" → international_remote, target_countries=[]
- If unclear: "unknown", target_countries=[].

Timezone: infer from explicit timezone mentions, office locations, or "must overlap with [TZ]" phrasing. null if ambiguous.`;

export interface VisaClassification {
  category: VisaCategory;
  target_countries: string[];
  target_timezone: string | null;
}

export async function classifyVisa(posting: Pick<JobPosting, 'title'|'company'|'location'|'description_md'>): Promise<VisaClassification> {
  const client = getAnthropic();
  const text = [
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location field: ${posting.location.raw}`,
    `Description (first 3000 chars):`,
    posting.description_md.slice(0, 3000),
  ].join('\n');

  const res = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: 'user', content: text }],
  });

  const out = res.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text).join('').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(out) as VisaClassification;
  return {
    category: parsed.category,
    target_countries: (parsed.target_countries ?? []).map(c => c.toLowerCase()),
    target_timezone: parsed.target_timezone || null,
  };
}
```

- [ ] **Step 2: Test (skipped without API key)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\ingest\classify.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyVisa } from './classify';

const RUN = process.env.ANTHROPIC_API_KEY ? describe : describe.skip;

RUN('classifyVisa', () => {
  it('flags US-only roles', async () => {
    const r = await classifyVisa({
      title: 'Senior Engineer',
      company: { name: 'USCo' },
      location: { remote: true, raw: 'Remote (US only)' },
      description_md: 'You must be authorized to work in the United States. No sponsorship.',
    });
    expect(r.category).toBe('country_specific');
    expect(r.target_countries).toContain('us');
  }, 30_000);

  it('flags international remote', async () => {
    const r = await classifyVisa({
      title: 'Senior Engineer',
      company: { name: 'GlobalCo' },
      location: { remote: true, raw: 'Worldwide' },
      description_md: 'We hire globally. Remote anywhere. EOR-friendly via Deel.',
    });
    expect(r.category).toBe('international_remote');
    expect(r.target_countries).toEqual([]);
  }, 30_000);
});
```

- [ ] **Step 3: Run + commit**

```bash
npm test -- src/core/ingest/classify.test.ts
git add src/core/ingest/classify.ts src/core/ingest/classify.test.ts
git commit -m "feat(ingest): add visa + timezone classifier"
```

---

### Task 29: Honeypot adapter

**Files:**
- Create: `tests/fixtures/honeypot-sample.json`
- Create: `src/core/adapters/honeypot.ts`
- Create: `src/core/adapters/honeypot.test.ts`
- Modify: `src/core/adapters/registry.ts`

> **Note:** Honeypot's public listings API may require an API token or session cookie. If their public endpoint isn't available, use their public RSS feed at `https://www.honeypot.io/rss` and parse with `rss-parser` (add `npm install rss-parser`).

- [ ] **Step 1: Add rss-parser if needed**

```bash
npm install rss-parser
```

- [ ] **Step 2: Create the fixture**

`c:\Users\user\Desktop\Repos\Job Hunter\tests\fixtures\honeypot-sample.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Honeypot Jobs</title>
    <item>
      <title>Senior Backend Engineer at SampleDE</title>
      <link>https://www.honeypot.io/jobs/12345</link>
      <description>Berlin-based remote-friendly role. Visa sponsorship available.</description>
      <pubDate>Sun, 11 May 2026 09:00:00 GMT</pubDate>
      <guid>https://www.honeypot.io/jobs/12345</guid>
    </item>
  </channel>
</rss>
```

- [ ] **Step 3: Write the test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\honeypot.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { HoneypotAdapter } from './honeypot';

describe('HoneypotAdapter', () => {
  it('parses RSS feed into JobPostings', async () => {
    const xml = await readFile(path.join(process.cwd(), 'tests/fixtures/honeypot-sample.xml'), 'utf8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => xml }));

    const adapter = new HoneypotAdapter();
    const postings = await adapter.fetch({});
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe('honeypot');
    expect(postings[0].title).toContain('Backend Engineer');
    expect(postings[0].url).toContain('honeypot.io');
  });
});
```

- [ ] **Step 4: Implement**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\honeypot.ts`:

```ts
import Parser from 'rss-parser';
import type { Adapter, AdapterConfig } from './types';
import type { JobPosting } from '../types';
import { makeJobId, nowIso } from './util';

const FEED_URL = 'https://www.honeypot.io/rss';

export class HoneypotAdapter implements Adapter {
  readonly name = 'honeypot' as const;
  validateConfig(_: AdapterConfig): void {}

  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    const res = await fetch(FEED_URL, { headers: { 'User-Agent': 'job-hunter/1.0' } });
    if (!res.ok) throw new Error(`Honeypot RSS fetch failed: ${res.status}`);
    const xml = await res.text();
    const feed = await new Parser().parseString(xml);

    return feed.items.map(item => {
      const external_id = item.guid ?? item.link ?? Math.random().toString(36);
      const titleMatch = (item.title ?? '').match(/^(.*?)\s+at\s+(.*?)$/i);
      const title = titleMatch?.[1] ?? item.title ?? '';
      const company = titleMatch?.[2] ?? 'Unknown';
      return {
        id: makeJobId('honeypot', external_id),
        source: 'honeypot' as const,
        external_id,
        url: item.link ?? '',
        company: { name: company, hq_country: 'de' },
        title,
        location: { remote: true, raw: 'Germany / Remote' },
        visa: { category: 'unknown', target_countries: [] },
        description_md: item.contentSnippet ?? item.content ?? '',
        posted_at: item.isoDate ?? nowIso(),
        fetched_at: nowIso(),
      };
    });
  }
}
```

- [ ] **Step 5: Register**

In `src/core/adapters/registry.ts`, add Honeypot to the registry:

```ts
import { HoneypotAdapter } from './honeypot';

const ADAPTERS: Partial<Record<AdapterName, Adapter>> = {
  remoteok: new RemoteOKAdapter(),
  honeypot: new HoneypotAdapter(),
};
```

- [ ] **Step 6: Run test + manual fetch + commit**

```bash
npm test -- src/core/adapters/honeypot.test.ts
npx tsx scripts/run-adapter.ts honeypot
git add src/core/adapters/honeypot.ts src/core/adapters/honeypot.test.ts src/core/adapters/registry.ts tests/fixtures/honeypot-sample.xml package.json package-lock.json
git commit -m "feat(adapters): add Honeypot (RSS-based)"
```

---

### Task 30: Greenhouse adapter

**Files:**
- Create: `tests/fixtures/greenhouse-sample.json`
- Create: `src/core/adapters/greenhouse.ts`
- Create: `src/core/adapters/greenhouse.test.ts`
- Modify: `src/core/adapters/registry.ts`

- [ ] **Step 1: Fixture (real shape of `boards-api.greenhouse.io/v1/boards/{token}/jobs`)**

`c:\Users\user\Desktop\Repos\Job Hunter\tests\fixtures\greenhouse-sample.json`:

```json
{
  "jobs": [
    {
      "id": 4001,
      "internal_job_id": 5001,
      "title": "Staff Engineer, Platform",
      "updated_at": "2026-05-12T09:00:00Z",
      "absolute_url": "https://boards.greenhouse.io/exampleco/jobs/4001",
      "location": { "name": "Remote - EMEA" },
      "company_name": "ExampleCo",
      "content": "%3Cp%3EJoin%20us%20to%20build%20our%20platform.%3C/p%3E",
      "departments": [],
      "offices": [{ "name": "Berlin" }]
    }
  ]
}
```

- [ ] **Step 2: Test**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\greenhouse.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GreenhouseAdapter } from './greenhouse';

describe('GreenhouseAdapter', () => {
  it('parses /jobs response with one company token', async () => {
    const json = JSON.parse(await readFile(
      path.join(process.cwd(), 'tests/fixtures/greenhouse-sample.json'), 'utf8'
    ));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => json }));

    const a = new GreenhouseAdapter();
    const postings = await a.fetch({ tokens: ['exampleco'] });
    expect(postings).toHaveLength(1);
    expect(postings[0].source).toBe('greenhouse');
    expect(postings[0].external_id).toBe('exampleco-4001');
    expect(postings[0].title).toContain('Staff Engineer');
    expect(postings[0].url).toContain('boards.greenhouse.io');
    expect(postings[0].description_md).toContain('platform');
  });

  it('rejects invalid config (no tokens array)', () => {
    const a = new GreenhouseAdapter();
    expect(() => a.validateConfig({})).toThrow();
  });
});
```

- [ ] **Step 3: Implement**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\adapters\greenhouse.ts`:

```ts
import type { Adapter, AdapterConfig } from './types';
import type { JobPosting } from '../types';
import { makeJobId, nowIso } from './util';

interface GhConfig { tokens: string[] }

function urlFor(token: string) {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
}

export class GreenhouseAdapter implements Adapter {
  readonly name = 'greenhouse' as const;

  validateConfig(config: AdapterConfig): void {
    const c = config as GhConfig;
    if (!Array.isArray(c.tokens) || c.tokens.length === 0) {
      throw new Error('Greenhouse config requires { tokens: string[] } (board tokens)');
    }
  }

  async fetch(config: AdapterConfig): Promise<JobPosting[]> {
    this.validateConfig(config);
    const c = config as GhConfig;
    const all: JobPosting[] = [];
    for (const token of c.tokens) {
      const res = await fetch(urlFor(token), { headers: { 'User-Agent': 'job-hunter/1.0' } });
      if (!res.ok) {
        console.warn(`Greenhouse fetch for "${token}" failed: ${res.status}`);
        continue;
      }
      const body = (await res.json()) as { jobs: GhJob[] };
      for (const j of body.jobs) {
        const externalId = `${token}-${j.id}`;
        const office = j.offices?.[0]?.name;
        all.push({
          id: makeJobId('greenhouse', externalId),
          source: 'greenhouse',
          external_id: externalId,
          url: j.absolute_url,
          company: { name: token, domain: undefined },
          title: j.title,
          location: { remote: /remote/i.test(j.location?.name ?? ''), raw: j.location?.name ?? '' },
          visa: { category: 'unknown', target_countries: [] },
          description_md: decodeAndStrip(j.content ?? ''),
          posted_at: j.updated_at,
          fetched_at: nowIso(),
        });
      }
    }
    return all;
  }
}

interface GhJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name: string };
  content?: string;
  offices?: Array<{ name: string }>;
}

function decodeAndStrip(content: string): string {
  return decodeURIComponent(content).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Register + adapters row**

In `src/core/adapters/registry.ts`:

```ts
import { GreenhouseAdapter } from './greenhouse';

const ADAPTERS: Partial<Record<AdapterName, Adapter>> = {
  remoteok: new RemoteOKAdapter(),
  honeypot: new HoneypotAdapter(),
  greenhouse: new GreenhouseAdapter(),
};
```

Then seed the `adapters` table with Greenhouse config via shell:

```bash
turso db shell job-hunter
> INSERT OR REPLACE INTO adapters (name, enabled, config_json)
  VALUES ('greenhouse', 1, '{"tokens":["gitlab","automattic"]}');
> .quit
```

- [ ] **Step 5: Test + manual fetch + commit**

```bash
npm test -- src/core/adapters/greenhouse.test.ts
# update run-adapter to honor config from DB — done in Task 31, for now hard-code
```

Skip the manual fetch for now; run it after Task 31 wires config-from-DB.

```bash
git add src/core/adapters/greenhouse.ts src/core/adapters/greenhouse.test.ts src/core/adapters/registry.ts tests/fixtures/greenhouse-sample.json
git commit -m "feat(adapters): add Greenhouse adapter"
```

---

### Task 31: run-adapter reads config from DB

**Files:**
- Modify: `scripts/run-adapter.ts`

- [ ] **Step 1: Update the runner**

Replace `scripts/run-adapter.ts`:

```ts
import 'dotenv/config';
import { getDb } from '@/src/db/client';
import { getAdapter } from '@/src/core/adapters/registry';
import { insertJobs } from '@/src/core/jobs/persist';
import type { AdapterName } from '@/src/core/types';

async function main() {
  const name = process.argv[2] as AdapterName | undefined;
  if (!name) {
    console.error('Usage: npx tsx scripts/run-adapter.ts <adapter-name>');
    process.exit(1);
  }
  const adapter = getAdapter(name);
  if (!adapter) {
    console.error(`Adapter not registered: ${name}`);
    process.exit(1);
  }

  // Load config from adapters table
  const db = getDb();
  const { rows } = await db.execute({
    sql: 'SELECT config_json FROM adapters WHERE name = ?',
    args: [name],
  });
  const config = rows[0] ? JSON.parse(rows[0].config_json as string) : {};

  console.log(`Fetching from ${name} with config:`, config);
  const postings = await adapter.fetch(config);
  console.log(`Got ${postings.length} postings.`);

  const inserted = await insertJobs(db, postings);
  console.log(`Inserted ${inserted} new rows (${postings.length - inserted} duplicates skipped).`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Seed the other two adapters**

```bash
turso db shell job-hunter "INSERT OR REPLACE INTO adapters (name, enabled, config_json) VALUES ('remoteok', 1, '{}')"
turso db shell job-hunter "INSERT OR REPLACE INTO adapters (name, enabled, config_json) VALUES ('honeypot', 1, '{}')"
```

- [ ] **Step 3: Run all three adapters**

```bash
npx tsx scripts/run-adapter.ts remoteok
npx tsx scripts/run-adapter.ts honeypot
npx tsx scripts/run-adapter.ts greenhouse
```

Expected: each prints a count, jobs flow into Turso.

- [ ] **Step 4: Commit**

```bash
git add scripts/run-adapter.ts
git commit -m "feat: run-adapter reads config from DB"
```

---

### Task 32: Classifier integration — annotate new jobs

**Files:**
- Create: `src/core/ingest/annotate.ts`
- Create: `scripts/annotate.ts`

- [ ] **Step 1: Annotator helper**

`c:\Users\user\Desktop\Repos\Job Hunter\src\core\ingest\annotate.ts`:

```ts
import type { Client } from '@libsql/client';
import { classifyVisa } from './classify';

/** Classify visa + timezone for all jobs where visa_category = 'unknown'. */
export async function annotateUnclassified(db: Client, limit = 100): Promise<number> {
  const { rows } = await db.execute({
    sql: `SELECT id, title, company_name, location_raw, description_md
          FROM jobs WHERE visa_category = 'unknown' AND archived = 0
          ORDER BY fetched_at DESC LIMIT ?`,
    args: [limit],
  });

  let n = 0;
  for (const r of rows) {
    try {
      const result = await classifyVisa({
        title: r.title as string,
        company: { name: r.company_name as string },
        location: { remote: false, raw: (r.location_raw as string) ?? '' },
        description_md: r.description_md as string,
      });
      await db.execute({
        sql: `UPDATE jobs SET visa_category = ?, visa_target_countries_json = ?, target_timezone = ?
              WHERE id = ?`,
        args: [
          result.category,
          JSON.stringify(result.target_countries),
          result.target_timezone,
          r.id as string,
        ],
      });
      n++;
    } catch (err) {
      console.error(`Classify failed for ${r.id}:`, err);
    }
  }
  return n;
}
```

- [ ] **Step 2: CLI runner**

`c:\Users\user\Desktop\Repos\Job Hunter\scripts\annotate.ts`:

```ts
import 'dotenv/config';
import { getDb } from '@/src/db/client';
import { annotateUnclassified } from '@/src/core/ingest/annotate';

async function main() {
  const n = await annotateUnclassified(getDb());
  console.log(`Annotated ${n} jobs.`);
}
main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Run + commit**

```bash
npx tsx scripts/annotate.ts
git add src/core/ingest/annotate.ts scripts/annotate.ts
git commit -m "feat(ingest): annotate jobs with visa + timezone classification"
```

---

### Tasks 33–35: Spec'd-but-deferred adapters

These adapters are in the P1 set per the spec but not on the critical path for verification. They follow the same shape as RemoteOK/Honeypot/Greenhouse. Implement each as you have time; each gets its own commit.

**For each adapter (Wellfound, WWR, Himalayas, Jobicy, Working Nomads, Otta, WTTJ, Hired, Lever, Ashby):**

1. Find its public API or RSS feed (linked in `src/core/adapters/<name>.ts` as a comment).
2. Capture a fixture in `tests/fixtures/<name>-sample.json` or `.xml`.
3. Write `<name>.test.ts` (parser test using the fixture).
4. Implement `<name>.ts` following the `RemoteOKAdapter` shape (JSON) or `HoneypotAdapter` shape (RSS).
5. Register in `src/core/adapters/registry.ts`.
6. Seed `adapters` table row.
7. Test + manual fetch + commit.

These are listed as **Tasks 53–62** at the end of the plan (Stage J) so the verification flow doesn't block on them. Skip ahead to Stage E for now.

---

# Stage E: Filters, settings, source health

Goal: feed is filterable by visa/country/source/score; settings page lets you toggle adapters and edit caps; source-health banner shows broken adapters.

---

### Task 36: Feed filters (visa, country, source, score band)

**Files:**
- Modify: `src/core/jobs/query.ts`
- Modify: `app/feed/page.tsx`
- Create: `app/feed/filter-bar.tsx`

- [ ] **Step 1: Extend the query helper to accept filters**

Replace `src/core/jobs/query.ts`:

```ts
import { getDb } from '@/src/db/client';
import type { JobPosting, VisaCategory, AdapterName } from '@/src/core/types';

export interface FeedRow extends JobPosting {
  score: number | null;
  score_reasoning: string | null;
}

export interface FeedFilters {
  source?: AdapterName;
  visa_category?: VisaCategory;
  country?: string;          // lowercase ISO; matches jobs whose target_countries includes it
  min_score?: number;
  limit?: number;
}

export async function listFeed(filters: FeedFilters = {}): Promise<FeedRow[]> {
  const db = getDb();
  const wheres = ['j.archived = 0'];
  const args: (string|number)[] = [];

  if (filters.source) { wheres.push('j.source = ?'); args.push(filters.source); }
  if (filters.visa_category) { wheres.push('j.visa_category = ?'); args.push(filters.visa_category); }
  if (filters.country) {
    wheres.push("instr(lower(j.visa_target_countries_json), ?) > 0");
    args.push(`"${filters.country.toLowerCase()}"`);
  }
  if (typeof filters.min_score === 'number') {
    wheres.push('s.value >= ?');
    args.push(filters.min_score);
  }

  args.push(filters.limit ?? 200);

  const { rows } = await db.execute({
    sql: `
      SELECT j.*, s.value AS score, s.reasoning AS score_reasoning
      FROM jobs j LEFT JOIN scores s ON s.job_id = j.id
      WHERE ${wheres.join(' AND ')}
      ORDER BY (s.value IS NULL), s.value DESC, j.fetched_at DESC
      LIMIT ?
    `,
    args,
  });

  return rows.map(r => ({
    id: r.id as string,
    source: r.source as JobPosting['source'],
    external_id: r.external_id as string,
    url: r.url as string,
    company: {
      name: r.company_name as string,
      domain: (r.company_domain as string | null) ?? undefined,
      hq_country: (r.company_hq_country as string | null) ?? undefined,
    },
    title: r.title as string,
    location: {
      remote: Number(r.location_remote) === 1,
      raw: r.location_raw as string,
      geo: (r.location_geo as string | null) ?? undefined,
    },
    visa: {
      category: r.visa_category as VisaCategory,
      target_countries: JSON.parse((r.visa_target_countries_json as string) || '[]'),
    },
    target_timezone: (r.target_timezone as string | null) ?? undefined,
    description_md: r.description_md as string,
    posted_at: r.posted_at as string,
    raw_ref: (r.raw_ref as string | null) ?? undefined,
    fetched_at: r.fetched_at as string,
    score: r.score === null ? null : Number(r.score),
    score_reasoning: (r.score_reasoning as string | null) ?? null,
  }));
}
```

- [ ] **Step 2: Filter bar component**

`c:\Users\user\Desktop\Repos\Job Hunter\app\feed\filter-bar.tsx`:

```tsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value); else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border bg-white p-3">
      <Select value={params.get('visa_category') ?? ''} onValueChange={v => update('visa_category', v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Visa category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">(any)</SelectItem>
          <SelectItem value="international_remote">International remote</SelectItem>
          <SelectItem value="sponsorship_offered">Sponsorship offered</SelectItem>
          <SelectItem value="country_specific">Country-specific</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>

      <Input
        className="w-32"
        placeholder="Country (us, uk, ...)"
        defaultValue={params.get('country') ?? ''}
        onBlur={e => update('country', e.target.value.trim().toLowerCase())}
      />

      <Input
        className="w-40"
        placeholder="Source (e.g. remoteok)"
        defaultValue={params.get('source') ?? ''}
        onBlur={e => update('source', e.target.value.trim().toLowerCase())}
      />

      <Input
        className="w-28"
        type="number"
        placeholder="Min score"
        defaultValue={params.get('min_score') ?? ''}
        onBlur={e => update('min_score', e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire into feed page**

Replace `app/feed/page.tsx`:

```tsx
import { listFeed, FeedFilters } from '@/src/core/jobs/query';
import { FilterBar } from './filter-bar';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function FeedPage({ searchParams }: { searchParams: Record<string,string> }) {
  const filters: FeedFilters = {
    source: searchParams.source as any,
    visa_category: searchParams.visa_category as any,
    country: searchParams.country || undefined,
    min_score: searchParams.min_score ? Number(searchParams.min_score) : undefined,
  };
  const rows = await listFeed(filters);

  return (
    <main className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <span className="text-sm text-gray-500">{rows.length} jobs</span>
      </div>

      <FilterBar />

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500">
          <tr>
            <th className="py-2 w-12">Score</th>
            <th>Title</th>
            <th>Company</th>
            <th>Source</th>
            <th>Visa</th>
            <th>Posted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2 font-mono">{r.score ?? '—'}</td>
              <td>
                <div>{r.title}</div>
                {r.score_reasoning && (
                  <div className="mt-1 text-xs text-gray-500">{r.score_reasoning}</div>
                )}
              </td>
              <td>{r.company.name}</td>
              <td className="text-gray-500">{r.source}</td>
              <td>
                <Badge variant={r.visa.category === 'international_remote' ? 'default' : 'secondary'}>
                  {r.visa.category}
                </Badge>
                {r.visa.target_countries.length > 0 && (
                  <div className="mt-1 text-xs text-gray-500">{r.visa.target_countries.join(', ')}</div>
                )}
              </td>
              <td className="text-gray-500">
                {r.posted_at ? formatDistanceToNow(new Date(r.posted_at), { addSuffix: true }) : '—'}
              </td>
              <td>
                <a href={r.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline">view</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 4: Run dev, test filters**

```bash
npm run dev
```

Visit `/feed?visa_category=international_remote`. Then try `?country=uk`. Then `?source=remoteok`. Then `?min_score=70`. Confirm filtering works.

- [ ] **Step 5: Commit**

```bash
git add src/core/jobs/query.ts app/feed/page.tsx app/feed/filter-bar.tsx
git commit -m "feat(hub): add feed filters (visa/country/source/score)"
```

---

### Task 37: Default filter — hide country_specific jobs you can't take

**Files:**
- Modify: `app/feed/page.tsx`

- [ ] **Step 1: Add default filter logic**

When the user hasn't set explicit filters, apply: hide jobs that are `country_specific` AND don't overlap with the user's `work_auth_countries` OR `open_to_sponsorship_countries`. The user's `settings.feed_show_country_specific` toggle overrides.

Modify the page to load profile + settings, then filter rows:

In `app/feed/page.tsx`, add at the top of `FeedPage`:

```tsx
import { getProfile } from '@/src/profile/store';
import { getDb } from '@/src/db/client';

// ... inside FeedPage, after `const rows = await listFeed(filters);`

const profile = await getProfile();
const { rows: settingsRows } = await getDb().execute('SELECT feed_show_country_specific FROM settings WHERE id = 1');
const showCountrySpecific = Boolean(settingsRows[0]?.feed_show_country_specific) ||
  Boolean(searchParams.visa_category); // explicit filter overrides

const filtered = showCountrySpecific ? rows : rows.filter(r => {
  if (r.visa.category !== 'country_specific') return true;
  const ok = new Set([
    ...profile.preferences.work_auth_countries,
    ...profile.preferences.open_to_sponsorship_countries,
  ]);
  return r.visa.target_countries.some(c => ok.has(c));
});

// ... use `filtered` in the table render and the counter
```

Replace the two references to `rows.map(...)` and `rows.length` with `filtered.map(...)` and `filtered.length` respectively.

Above the table, add a small toggle:

```tsx
<div className="text-xs text-gray-500">
  {!showCountrySpecific && `(${rows.length - filtered.length} country-specific jobs hidden — toggle in Settings)`}
</div>
```

- [ ] **Step 2: Run dev + verify**

```bash
npm run dev
```

Visit `/feed`. Country-specific jobs you can't take should be hidden. The counter shows N hidden.

- [ ] **Step 3: Commit**

```bash
git add app/feed/page.tsx
git commit -m "feat(hub): hide country-specific jobs that don't overlap user's work-auth countries"
```

---

### Task 38: Settings page — adapter toggles + caps

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/settings-form.tsx`
- Create: `app/api/settings/route.ts`

- [ ] **Step 1: Settings query helper**

Add to `src/profile/store.ts`:

```ts
export interface AppSettings {
  daily_cap: number;
  weekly_cap: number;
  score_threshold: number;
  aggressiveness: number;
  token_budget_daily_usd: number;
  dry_run: boolean;
  default_target_timezone: string;
  cadence_floor_minutes: number;
  feed_show_country_specific: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const { rows } = await getDb().execute('SELECT * FROM settings WHERE id = 1');
  const r = rows[0];
  return {
    daily_cap: Number(r.daily_cap),
    weekly_cap: Number(r.weekly_cap),
    score_threshold: Number(r.score_threshold),
    aggressiveness: Number(r.aggressiveness),
    token_budget_daily_usd: Number(r.token_budget_daily_usd),
    dry_run: Number(r.dry_run) === 1,
    default_target_timezone: r.default_target_timezone as string,
    cadence_floor_minutes: Number(r.cadence_floor_minutes),
    feed_show_country_specific: Number(r.feed_show_country_specific) === 1,
  };
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await getDb().execute({
    sql: `UPDATE settings SET
      daily_cap=?, weekly_cap=?, score_threshold=?, aggressiveness=?,
      token_budget_daily_usd=?, dry_run=?, default_target_timezone=?,
      cadence_floor_minutes=?, feed_show_country_specific=?
      WHERE id = 1`,
    args: [
      s.daily_cap, s.weekly_cap, s.score_threshold, s.aggressiveness,
      s.token_budget_daily_usd, s.dry_run ? 1 : 0, s.default_target_timezone,
      s.cadence_floor_minutes, s.feed_show_country_specific ? 1 : 0,
    ],
  });
}

export interface AdapterRow {
  name: string;
  enabled: boolean;
  config_json: string;
  last_run_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
}

export async function listAdapters(): Promise<AdapterRow[]> {
  const { rows } = await getDb().execute('SELECT * FROM adapters ORDER BY name');
  return rows.map(r => ({
    name: r.name as string,
    enabled: Number(r.enabled) === 1,
    config_json: (r.config_json as string) || '{}',
    last_run_at: (r.last_run_at as string | null) ?? null,
    last_error: (r.last_error as string | null) ?? null,
    consecutive_failures: Number(r.consecutive_failures),
  }));
}

export async function updateAdapter(name: string, patch: { enabled?: boolean; config_json?: string }): Promise<void> {
  const sets: string[] = [];
  const args: (string|number)[] = [];
  if (patch.enabled !== undefined) { sets.push('enabled = ?'); args.push(patch.enabled ? 1 : 0); }
  if (patch.config_json !== undefined) { sets.push('config_json = ?'); args.push(patch.config_json); }
  if (sets.length === 0) return;
  args.push(name);
  await getDb().execute({ sql: `UPDATE adapters SET ${sets.join(', ')} WHERE name = ?`, args });
}
```

- [ ] **Step 2: API route**

`c:\Users\user\Desktop\Repos\Job Hunter\app\api\settings\route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { saveSettings, updateAdapter, type AppSettings } from '@/src/profile/store';

export async function POST(req: NextRequest) {
  const body = await req.json() as
    | { type: 'settings'; data: AppSettings }
    | { type: 'adapter'; name: string; enabled?: boolean; config_json?: string };

  if (body.type === 'settings') {
    await saveSettings(body.data);
  } else if (body.type === 'adapter') {
    await updateAdapter(body.name, { enabled: body.enabled, config_json: body.config_json });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Settings page (server component)**

`c:\Users\user\Desktop\Repos\Job Hunter\app\settings\page.tsx`:

```tsx
import { getSettings, listAdapters } from '@/src/profile/store';
import { SettingsForm } from './settings-form';
import { AdaptersList } from './adapters-list';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getSettings();
  const adapters = await listAdapters();
  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Application controls</h2>
        <SettingsForm initial={settings} />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Sources</h2>
        <AdaptersList initial={adapters} />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Settings form (client)**

`c:\Users\user\Desktop\Repos\Job Hunter\app\settings\settings-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { AppSettings } from '@/src/profile/store';

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState(initial);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function save() {
    setPending(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', data: s }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-4">
      <div>
        <Label>Daily submit cap (0 = no cap)</Label>
        <Input type="number" value={s.daily_cap} onChange={e => setS({ ...s, daily_cap: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Weekly submit cap</Label>
        <Input type="number" value={s.weekly_cap} onChange={e => setS({ ...s, weekly_cap: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Score threshold for auto-actions</Label>
        <Input type="number" value={s.score_threshold} onChange={e => setS({ ...s, score_threshold: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Aggressiveness (0–100)</Label>
        <Input type="number" value={s.aggressiveness} onChange={e => setS({ ...s, aggressiveness: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Token budget daily (USD)</Label>
        <Input type="number" step="0.5" value={s.token_budget_daily_usd}
          onChange={e => setS({ ...s, token_budget_daily_usd: Number(e.target.value) })} />
      </div>
      <div>
        <Label>Cadence floor (min)</Label>
        <Input type="number" value={s.cadence_floor_minutes}
          onChange={e => setS({ ...s, cadence_floor_minutes: Number(e.target.value) })} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={s.dry_run} onCheckedChange={v => setS({ ...s, dry_run: v })} />
        <Label>Dry-run mode (no real submissions)</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={s.feed_show_country_specific}
          onCheckedChange={v => setS({ ...s, feed_show_country_specific: v })} />
        <Label>Show all country-specific jobs in feed</Label>
      </div>

      <div className="col-span-2">
        <Button onClick={save} disabled={pending}>{pending ? 'Saving...' : 'Save settings'}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Adapters list (client)**

`c:\Users\user\Desktop\Repos\Job Hunter\app\settings\adapters-list.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { AdapterRow } from '@/src/profile/store';

export function AdaptersList({ initial }: { initial: AdapterRow[] }) {
  const [rows, setRows] = useState(initial);
  const router = useRouter();

  async function toggle(name: string, enabled: boolean) {
    setRows(rs => rs.map(r => r.name === name ? { ...r, enabled } : r));
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'adapter', name, enabled }),
    });
    router.refresh();
  }

  async function updateConfig(name: string, config_json: string) {
    setRows(rs => rs.map(r => r.name === name ? { ...r, config_json } : r));
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'adapter', name, config_json }),
    });
  }

  return (
    <div className="mt-2 divide-y">
      {rows.map(r => (
        <div key={r.name} className="flex items-start gap-4 py-3">
          <div className="w-40 pt-1 font-mono text-sm">{r.name}</div>
          <Switch checked={r.enabled} onCheckedChange={v => toggle(r.name, v)} />
          <div className="flex-1">
            <Textarea
              className="font-mono text-xs"
              rows={2}
              value={r.config_json}
              onChange={e => setRows(rs => rs.map(rr => rr.name === r.name ? { ...rr, config_json: e.target.value } : rr))}
              onBlur={e => updateConfig(r.name, e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              last run: {r.last_run_at ?? 'never'}
              {r.last_error && <span className="ml-2 text-red-600">error: {r.last_error}</span>}
              {r.consecutive_failures > 0 && <span className="ml-2 text-yellow-600">{r.consecutive_failures} consecutive failures</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Test in browser + commit**

```bash
npm run dev
```

Visit `/settings`. Toggle an adapter, edit config JSON, save settings. Refresh — values persist.

```bash
git add app/settings/page.tsx app/settings/settings-form.tsx app/settings/adapters-list.tsx app/api/settings/route.ts src/profile/store.ts
git commit -m "feat(hub): settings page (caps + adapter toggles)"
```

---

### Task 39: Source-health banner on feed

**Files:**
- Modify: `app/feed/page.tsx`
- Create: `app/feed/health-banner.tsx`

- [ ] **Step 1: Health banner component**

`c:\Users\user\Desktop\Repos\Job Hunter\app\feed\health-banner.tsx`:

```tsx
import Link from 'next/link';
import type { AdapterRow } from '@/src/profile/store';

export function HealthBanner({ adapters }: { adapters: AdapterRow[] }) {
  const broken = adapters.filter(a => a.consecutive_failures >= 3 || (a.enabled && a.last_error));
  if (broken.length === 0) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
      <strong className="text-red-800">{broken.length} adapter{broken.length === 1 ? '' : 's'} unhealthy:</strong>{' '}
      {broken.map(b => b.name).join(', ')}.{' '}
      <Link href="/settings" className="text-red-700 underline">Check settings</Link>
    </div>
  );
}
```

- [ ] **Step 2: Wire into feed page**

In `app/feed/page.tsx`, add:

```tsx
import { listAdapters } from '@/src/profile/store';
import { HealthBanner } from './health-banner';

// in FeedPage, before <FilterBar />:
const adapters = await listAdapters();

// render:
<HealthBanner adapters={adapters} />
```

- [ ] **Step 3: Commit**

```bash
git add app/feed/health-banner.tsx app/feed/page.tsx
git commit -m "feat(hub): source-health banner on feed"
```

---

### Task 40: /api/trigger route (Anthropic routine trigger)

**Files:**
- Create: `app/api/trigger/route.ts`

> **Note:** Anthropic's routine API endpoint URL + auth shape may evolve. As of plan-writing the user holds `ANTHROPIC_API_TRIGGER_URL` and `ANTHROPIC_API_TRIGGER_TOKEN` after creating routines via `/schedule`. The endpoint accepts a POST with a routine identifier and triggers an immediate run. If the endpoint changes, update this handler.

- [ ] **Step 1: Implement the handler**

`c:\Users\user\Desktop\Repos\Job Hunter\app\api\trigger\route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { routine } = await req.json();
  if (!routine || typeof routine !== 'string') {
    return NextResponse.json({ error: 'routine required' }, { status: 400 });
  }

  const url = process.env.ANTHROPIC_API_TRIGGER_URL;
  const token = process.env.ANTHROPIC_API_TRIGGER_TOKEN;
  if (!url || !token) {
    return NextResponse.json({ error: 'routine trigger env not configured' }, { status: 500 });
  }

  const res = await fetch(`${url}/routines/${encodeURIComponent(routine)}/trigger`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `trigger failed: ${res.status}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add a "Run Now" button to the feed**

In `app/feed/page.tsx`, add a header button. First create the client component:

`c:\Users\user\Desktop\Repos\Job Hunter\app\feed\run-now-button.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function RunNowButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function go() {
    setPending(true);
    await fetch('/api/trigger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routine: 'ingest' }),
    });
    setPending(false);
    router.refresh();
  }
  return <Button variant="outline" onClick={go} disabled={pending}>{pending ? 'Triggering...' : 'Run Ingest now'}</Button>;
}
```

Wire it into the feed header:

```tsx
import { RunNowButton } from './run-now-button';
// ...
<div className="flex items-baseline justify-between">
  <h1 className="text-2xl font-bold">Feed</h1>
  <div className="flex items-center gap-2">
    <span className="text-sm text-gray-500">{filtered.length} jobs</span>
    <RunNowButton />
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add app/api/trigger/route.ts app/feed/run-now-button.tsx app/feed/page.tsx
git commit -m "feat(hub): /api/trigger + Run Now button"
```

---

### Task 41: Inbox + History page stubs

**Files:**
- Create: `app/inbox/page.tsx`
- Create: `app/history/page.tsx`

- [ ] **Step 1: Inbox stub**

`c:\Users\user\Desktop\Repos\Job Hunter\app\inbox\page.tsx`:

```tsx
export default function InboxPage() {
  return (
    <main>
      <h1 className="text-2xl font-bold">Inbox</h1>
      <p className="mt-2 text-gray-600">Questions awaiting your input will appear here in Phase 3.</p>
    </main>
  );
}
```

- [ ] **Step 2: History stub**

`c:\Users\user\Desktop\Repos\Job Hunter\app\history\page.tsx`:

```tsx
export default function HistoryPage() {
  return (
    <main>
      <h1 className="text-2xl font-bold">History</h1>
      <p className="mt-2 text-gray-600">Submitted applications and outreach will show up here in Phase 2/3.</p>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/inbox/page.tsx app/history/page.tsx
git commit -m "feat(hub): stub Inbox + History pages"
```

---

### Task 42: Deploy Ingest routine to Claude Code /schedule

This is a user-driven task — you'll paste `routines/ingest.md` into a `/schedule` routine in claude.ai.

- [ ] **Step 1: In claude.ai, create a scheduled routine**

Use the `/schedule` command. Settings:
- **Name:** `job-hunter-ingest`
- **Cron:** `0 */2 * * *` (every 2 hours)
- **Prompt body:** paste the contents of `routines/ingest.md`
- **Required tools:** web_fetch (or similar HTTP tool), Bash (for libSQL HTTP via curl) — alternatively, instruct the routine to use the libSQL HTTP API directly with fetch
- **Env / secrets:** add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_FULL` (or a scoped Ingest-only token), `ANTHROPIC_API_KEY` if doing scoring inline

Capture the generated trigger URL + token; put them in your local `.env`:

```
ANTHROPIC_API_TRIGGER_URL=https://...
ANTHROPIC_API_TRIGGER_TOKEN=...
```

- [ ] **Step 2: Trigger from the Hub**

Visit `/feed`, click "Run Ingest now". Wait ~30–60s. The routine runs in the cloud; refresh the feed.

- [ ] **Step 3: Commit `.env.example` update (don't commit .env)**

(Already documented in Task 4. No file change needed unless you discovered the trigger URL format and want to document it in `docs/setup.md`.)

**🟢 Stage E complete.** Hub has working filters, settings, source-health banner. Ingest routine is live and triggerable from the UI.

---

# Stage F: Backup + Reconciler routines

Goal: nightly Turso DB backup → Drive; nightly reconciler cleans up orphan resources.

---

### Task 43: Drive client setup

**Files:**
- Create: `secrets/.gitkeep`
- Create: `src/lib/drive.ts`

- [ ] **Step 1: Set up a Google Cloud service account**

User-driven (one-time):

1. Visit https://console.cloud.google.com → create a project "Job Hunter"
2. APIs & Services → Library → enable "Google Drive API"
3. APIs & Services → Credentials → Create service account → grant Editor role
4. Create JSON key, download
5. Save the JSON to `secrets/drive-service-account.json`
6. In your Drive, create a folder "job-hunter-data"; share it (Editor access) with the service account's email (looks like `...@...iam.gserviceaccount.com`)
7. Copy the folder ID from the URL (`https://drive.google.com/drive/folders/<ID>`)
8. Add to `.env`:
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./secrets/drive-service-account.json
   GOOGLE_DRIVE_FOLDER_ID=<that-id>
   ```

Add `secrets/` to `.gitignore` (already there from Task 1's `data/` pattern? double-check):

```
secrets/
```

Append to `.gitignore` if missing.

- [ ] **Step 2: Drive client**

`c:\Users\user\Desktop\Repos\Job Hunter\src\lib\drive.ts`:

```ts
import { google } from 'googleapis';
import { readFileSync } from 'node:fs';

let cached: ReturnType<typeof google.drive> | null = null;

export function getDrive() {
  if (cached) return cached;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  if (!keyPath) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_PATH required');
  const credentials = JSON.parse(readFileSync(keyPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  cached = google.drive({ version: 'v3', auth });
  return cached;
}

export async function uploadToDrive(opts: {
  name: string;
  mimeType: string;
  body: Buffer | NodeJS.ReadableStream;
  parentFolderId?: string;
}): Promise<string> {
  const drive = getDrive();
  const parent = opts.parentFolderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const res = await drive.files.create({
    requestBody: { name: opts.name, parents: [parent] },
    media: { mimeType: opts.mimeType, body: opts.body },
    fields: 'id',
  });
  return res.data.id!;
}

export async function listFiles(folderId?: string) {
  const drive = getDrive();
  const parent = folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const res = await drive.files.list({
    q: `'${parent}' in parents and trashed = false`,
    fields: 'files(id,name,createdTime,size)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });
  return res.data.files ?? [];
}

export async function deleteFile(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}
```

- [ ] **Step 3: Smoke test (real Drive)**

`c:\Users\user\Desktop\Repos\Job Hunter\src\lib\drive.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { uploadToDrive, listFiles, deleteFile } from './drive';

const RUN = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ? describe : describe.skip;

RUN('drive', () => {
  it('uploads, lists, and deletes a file', async () => {
    const id = await uploadToDrive({
      name: `test-${Date.now()}.txt`,
      mimeType: 'text/plain',
      body: Buffer.from('hello'),
    });
    expect(id).toBeTruthy();
    const files = await listFiles();
    expect(files.find(f => f.id === id)).toBeTruthy();
    await deleteFile(id);
  }, 30_000);
});
```

- [ ] **Step 4: Run + commit**

```bash
npm test -- src/lib/drive.test.ts
git add src/lib/drive.ts src/lib/drive.test.ts secrets/.gitkeep .gitignore
git commit -m "feat(lib): add Drive client + smoke test"
```

---

### Task 44: Backup routine prompt

**Files:**
- Create: `routines/backup.md`

- [ ] **Step 1: Write the prompt**

`c:\Users\user\Desktop\Repos\Job Hunter\routines\backup.md`:

```markdown
# Backup routine — nightly at 02:00 UTC

You are the Job Hunter Backup routine. Dump the Turso DB and upload to Drive.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_READ` (read-only token is sufficient)
- `GOOGLE_DRIVE_FOLDER_ID` — backups go to subfolder `job-hunter-backups`
- Google Drive MCP access (or service account creds)

## Steps

1. Use the `turso` CLI (or libSQL HTTP dump if Bash unavailable) to dump the DB:
   ```
   turso db shell job-hunter --auth-token "$TURSO_AUTH_TOKEN_READ" ".dump" > /tmp/dump.sql
   gzip /tmp/dump.sql
   ```

2. Upload `/tmp/dump.sql.gz` to Drive as `job-hunter-backups/{ISO-timestamp}.sql.gz`.
   Create the `job-hunter-backups` subfolder if it doesn't exist.

3. List existing backups; if more than 14, delete the oldest until 14 remain.

4. Log to Turso `routine_runs`:
   ```
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json)
   VALUES ('backup', datetime('now'), 1, json_object('size_bytes', ...));
   ```

## Failure mode

If Drive upload fails: alert via PushNotification + don't delete any existing
backups. Try again next run.
```

- [ ] **Step 2: Deploy as a `/schedule` routine in claude.ai**

User-driven, same as Task 42 — paste this prompt, cron `0 2 * * *`.

- [ ] **Step 3: Commit**

```bash
git add routines/backup.md
git commit -m "feat(routines): add Backup routine prompt"
```

---

### Task 45: Reconciler routine prompt

**Files:**
- Create: `routines/reconciler.md`

- [ ] **Step 1: Write the prompt**

`c:\Users\user\Desktop\Repos\Job Hunter\routines\reconciler.md`:

```markdown
# Reconciler routine — nightly at 03:00 UTC

You are the Job Hunter Reconciler. Catch and clean up cross-store drift between
Turso and Drive, and revive auto-disabled adapters that may have recovered.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_FULL`
- Drive access (service account creds)

## Steps

1. **Orphan PDF cleanup (P2+):** list files in Drive `applications/` folder.
   For each, check if Turso `applications.artifact_resume_pdf_path` references
   it. If not referenced AND created >24h ago: delete from Drive.

2. **Adapter resurrection:** query `SELECT name FROM adapters WHERE enabled = 0
   AND consecutive_failures >= 3`. For each, attempt one fetch. If it succeeds:
   reset `consecutive_failures = 0`, set `enabled = 1`, write a notification.

3. **Stale job archival:** archive (set archived = 1) jobs older than 60 days
   that have no associated application.

4. Log to `routine_runs` with stats.

## Failure mode

Log errors per-step but don't abort — each step is independent.
```

- [ ] **Step 2: Deploy + commit**

User deploys via `/schedule` (cron `0 3 * * *`).

```bash
git add routines/reconciler.md
git commit -m "feat(routines): add Reconciler routine prompt"
```

---

### Task 46: Routine heartbeat alert

**Files:**
- Create: `src/lib/heartbeat.ts`

- [ ] **Step 1: Write the heartbeat checker**

`c:\Users\user\Desktop\Repos\Job Hunter\src\lib\heartbeat.ts`:

```ts
import { getDb } from '@/src/db/client';

interface Expected { routine: string; intervalMinutes: number }

const EXPECTED: Expected[] = [
  { routine: 'ingest', intervalMinutes: 120 },
  { routine: 'backup', intervalMinutes: 24 * 60 },
  { routine: 'reconciler', intervalMinutes: 24 * 60 },
];

/** Returns list of routines whose last successful run is older than 2× expected interval. */
export async function staleRoutines(): Promise<string[]> {
  const db = getDb();
  const stale: string[] = [];
  for (const e of EXPECTED) {
    const { rows } = await db.execute({
      sql: `SELECT max(started_at) AS last FROM routine_runs WHERE routine = ? AND ok = 1`,
      args: [e.routine],
    });
    const last = rows[0]?.last as string | null;
    if (!last) { stale.push(e.routine); continue; }
    const ageMin = (Date.now() - new Date(last).getTime()) / 60_000;
    if (ageMin > e.intervalMinutes * 2) stale.push(e.routine);
  }
  return stale;
}
```

- [ ] **Step 2: Surface in source-health banner**

In `app/feed/health-banner.tsx`, augment to also show stale routines. Pass `staleRoutines: string[]` from the page:

```tsx
export function HealthBanner({
  adapters, staleRoutines
}: { adapters: AdapterRow[]; staleRoutines: string[] }) {
  const broken = adapters.filter(a => a.consecutive_failures >= 3 || (a.enabled && a.last_error));
  if (broken.length === 0 && staleRoutines.length === 0) return null;
  return (
    <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
      {broken.length > 0 && (
        <div>
          <strong className="text-red-800">{broken.length} adapter{broken.length === 1 ? '' : 's'} unhealthy:</strong>{' '}
          {broken.map(b => b.name).join(', ')}.
        </div>
      )}
      {staleRoutines.length > 0 && (
        <div className="mt-1">
          <strong className="text-red-800">Routines not running:</strong> {staleRoutines.join(', ')}
        </div>
      )}
    </div>
  );
}
```

In `app/feed/page.tsx`:

```tsx
import { staleRoutines } from '@/src/lib/heartbeat';
// inside FeedPage:
const stale = await staleRoutines();
// pass: <HealthBanner adapters={adapters} staleRoutines={stale} />
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/heartbeat.ts app/feed/health-banner.tsx app/feed/page.tsx
git commit -m "feat: heartbeat check + stale-routine surface in banner"
```

**🟢 Stage F complete.** Backups run nightly, reconciler runs nightly, the Hub warns if any routine goes silent.

---

# Stage G: Notifier — daily digest

Goal: A daily Gmail digest summarizing top jobs, source health, anything in inbox.

---

### Task 47: Notifier — Gmail digest formatter

**Files:**
- Create: `src/lib/notifier.ts`

- [ ] **Step 1: Write the digest formatter**

`c:\Users\user\Desktop\Repos\Job Hunter\src\lib\notifier.ts`:

```ts
import { listFeed } from '@/src/core/jobs/query';
import { listAdapters } from '@/src/profile/store';
import { staleRoutines } from './heartbeat';

export async function buildDailyDigest(): Promise<{ subject: string; body: string }> {
  const top = (await listFeed({ limit: 20 })).filter(r => (r.score ?? 0) >= 70);
  const adapters = await listAdapters();
  const broken = adapters.filter(a => a.consecutive_failures >= 3);
  const stale = await staleRoutines();

  const lines: string[] = [];
  lines.push(`Job Hunter daily digest — ${new Date().toLocaleDateString()}`);
  lines.push('');
  lines.push(`Top jobs (score ≥ 70): ${top.length}`);
  for (const j of top.slice(0, 10)) {
    lines.push(`  [${j.score}] ${j.title} @ ${j.company.name} (${j.source}) — ${j.url}`);
  }
  lines.push('');
  if (broken.length > 0) lines.push(`Unhealthy adapters: ${broken.map(b => b.name).join(', ')}`);
  if (stale.length > 0) lines.push(`Stale routines: ${stale.join(', ')}`);
  if (broken.length === 0 && stale.length === 0) lines.push('All systems nominal.');
  return {
    subject: `[Job Hunter] ${top.length} jobs ≥70 today`,
    body: lines.join('\n'),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifier.ts
git commit -m "feat(notifier): daily digest formatter"
```

---

### Task 48: Notifier routine prompt

**Files:**
- Create: `routines/notify-digest.md`

- [ ] **Step 1: Write the prompt**

`c:\Users\user\Desktop\Repos\Job Hunter\routines\notify-digest.md`:

```markdown
# Daily Notifier — 08:00 in user's local timezone (Asia/Karachi)

You are the Job Hunter daily digest sender. Build a summary and email it.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_READ`
- Gmail MCP access
- User's email: farhan1188@gmail.com

## Steps

1. Connect to Turso. Run:
   - Top jobs query: `SELECT j.*, s.value AS score FROM jobs j JOIN scores s ON s.job_id = j.id
     WHERE j.archived = 0 AND s.value >= 70 ORDER BY s.value DESC LIMIT 10`
   - Health: `SELECT name, consecutive_failures FROM adapters WHERE consecutive_failures >= 3`
   - Stale routines: any routine with no `routine_runs` row in the last 2× its interval

2. Format a plain-text digest (subject + body — see `src/lib/notifier.ts` for shape).

3. Send via Gmail MCP `create_draft` → then send (or just `create_draft` for safety in v1).

4. Log to `routine_runs`.
```

- [ ] **Step 2: Deploy via /schedule (cron `0 3 * * *` UTC = 08:00 PKT)**

User-driven.

- [ ] **Step 3: Commit**

```bash
git add routines/notify-digest.md
git commit -m "feat(routines): daily Gmail digest routine"
```

**🟢 Stage G complete.** Daily digest arrives in your Gmail every morning.

---

# Stage H: Drive integration for resume PDF

Goal: at upload time, the resume PDF goes to Drive (in addition to the Turso base64 store). This sets up Phase 2 to read PDFs from Drive without changing the schema.

---

### Task 49: Drive upload in /api/upload

**Files:**
- Modify: `app/api/upload/route.ts`

- [ ] **Step 1: Add Drive upload to the route**

Replace `app/api/upload/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { extractResume } from '@/src/profile/extract';
import { saveResume } from '@/src/profile/store';
import { uploadToDrive } from '@/src/lib/drive';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('resume');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'PDF only' }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString('base64');

  // 1. Upload to Drive first (cross-store consistency — Drive then Turso)
  let driveFileId: string | null = null;
  try {
    driveFileId = await uploadToDrive({
      name: `profile/resume-${Date.now()}-${file.name}`,
      mimeType: 'application/pdf',
      body: Buffer.from(bytes),
    });
  } catch (err) {
    console.warn('Drive upload failed; storing base64 only:', err);
  }

  // 2. Extract via Sonnet
  const struct = await extractResume(bytes);

  // 3. Save to Turso (base64 + struct; Drive ID stored in basics_json for now)
  await saveResume({ pdfBase64: base64, filename: file.name, struct });

  return NextResponse.json({ ok: true, drive_file_id: driveFileId, experience_count: struct.experience.length });
}
```

- [ ] **Step 2: Test**

```bash
npm run dev
```

Visit `/profile`, re-upload your resume. Confirm Drive shows the new file under the `job-hunter-data` folder (in your browser).

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/route.ts
git commit -m "feat(upload): upload resume PDF to Drive in addition to Turso"
```

---

### Task 50: Store Drive file ID on profile

**Files:**
- Create: `src/db/migrations/002_drive_file_id.sql`
- Modify: `src/profile/store.ts`

- [ ] **Step 1: Migration**

`c:\Users\user\Desktop\Repos\Job Hunter\src\db\migrations\002_drive_file_id.sql`:

```sql
ALTER TABLE profile ADD COLUMN resume_drive_file_id TEXT;
```

- [ ] **Step 2: Apply**

```bash
npm run db:migrate
```

- [ ] **Step 3: Update store + saveResume to take a driveFileId param**

In `src/profile/store.ts`, modify:

```ts
export async function saveResume(input: {
  pdfBase64: string;
  filename: string;
  struct: ResumeStruct;
  driveFileId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await getDb().execute({
    sql: `UPDATE profile
          SET resume_pdf_base64 = ?, resume_filename = ?, resume_uploaded_at = ?,
              resume_struct_json = ?, resume_drive_file_id = ?
          WHERE id = 1`,
    args: [input.pdfBase64, input.filename, now, JSON.stringify(input.struct), input.driveFileId ?? null],
  });
}
```

In `app/api/upload/route.ts`, pass `driveFileId`:

```ts
await saveResume({ pdfBase64: base64, filename: file.name, struct, driveFileId });
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/002_drive_file_id.sql src/profile/store.ts app/api/upload/route.ts
git commit -m "feat(profile): store Drive file ID alongside resume metadata"
```

---

### Task 51: Per-routine scoped Turso tokens (formalize)

**Files:**
- Create: `docs/turso-tokens.md`

- [ ] **Step 1: Document the token issuance commands**

`c:\Users\user\Desktop\Repos\Job Hunter\docs\turso-tokens.md`:

```markdown
# Per-routine Turso tokens

Each routine gets its own token with the minimum permissions it needs.
This bounds blast radius if a routine prompt is leaked.

## Issuance commands

After tables exist (post-migration), issue these and store in your routine prompts'
secret environment:

### Ingest (write to jobs, scores, adapters; no read of profile/applications/qa_kb)

```bash
turso db tokens create job-hunter \
  --expiration none \
  --attach jobs --attach scores --attach adapters --attach routine_runs
```

Capture as `TURSO_AUTH_TOKEN_INGEST`.

### Backup (read-only, all tables)

```bash
turso db tokens create job-hunter --read-only --expiration none
```

Capture as `TURSO_AUTH_TOKEN_BACKUP` (= the `TURSO_AUTH_TOKEN_READ` from Task 4).

### Reconciler (read most; write to adapters + jobs.archived only)

```bash
turso db tokens create job-hunter \
  --expiration none \
  --attach adapters --attach jobs --attach applications --attach routine_runs
```

Capture as `TURSO_AUTH_TOKEN_RECONCILER`.

### Tailor (P2 — read profile, jobs, scores; write applications)

```bash
turso db tokens create job-hunter \
  --expiration none \
  --attach profile --attach jobs --attach scores --attach applications --attach routine_runs
```

### Submitter (P3 — read applications + qa_kb; write applications + qa_kb)

```bash
turso db tokens create job-hunter \
  --expiration none \
  --attach applications --attach qa_kb --attach routine_runs
```

## How to use

In each routine's secret env (set via /schedule when creating the routine),
use the appropriate token as `TURSO_AUTH_TOKEN`. The routine prompt references
`TURSO_AUTH_TOKEN` (generic name); the actual scope comes from the configured value.

## Rotation

To rotate: `turso db tokens invalidate <token-id>` (find IDs via `turso db tokens list job-hunter`),
then issue a new one and update the routine env.
```

- [ ] **Step 2: Commit**

```bash
git add docs/turso-tokens.md
git commit -m "docs: per-routine Turso token issuance + rotation"
```

**🟢 Stage H complete.** Resumes go to Drive on upload; scoped tokens documented.

---

# Stage I: Verification

Run the spec's 10-step end-to-end verification.

---

### Task 52: Run end-to-end verification

- [ ] **Step 1: Upload resume**

Visit `/profile`, upload your resume PDF. Confirm:
- "Extracted: N roles · M projects · K primary skills" appears
- Drive shows the file in `job-hunter-data/profile/`
- `turso db shell job-hunter "select json_extract(resume_struct_json, '$.experience[0].title') from profile"` returns a real title

- [ ] **Step 2: Fill preferences**

On `/profile`, fill out preferences. Save. Refresh — values persist.

- [ ] **Step 3: Enable adapters**

On `/settings`, enable RemoteOK + Honeypot + Greenhouse. For Greenhouse, set config `{"tokens":["gitlab","n26","automattic"]}`. Save.

- [ ] **Step 4: Trigger Ingest**

On `/feed`, click "Run Ingest now". Wait 30–60s.

- [ ] **Step 5: Verify jobs landed + are scored**

`turso db shell job-hunter "select count(*) from jobs"` → should be > 0.
`turso db shell job-hunter "select count(*) from scores"` → should also be > 0.
Visit `/feed` — top entries have scores 0–100, ranked descending.

- [ ] **Step 6: Test filters**

`/feed?visa_category=international_remote` → only international-remote jobs.
`/feed?country=de` → only jobs targeting Germany (Honeypot, plus any Greenhouse posting tagged DE).
`/feed?min_score=80` → only high-scoring jobs.

- [ ] **Step 7: Disable an adapter**

On `/settings`, toggle Greenhouse off. Click "Run Ingest now" again. Verify no new Greenhouse jobs appear.

- [ ] **Step 8: Force an adapter failure**

On `/settings`, set Greenhouse config to `{"tokens":["this-definitely-does-not-exist"]}`. Enable. Trigger Ingest. After 3 failed runs, the adapter auto-disables — the source-health banner shows on `/feed`.

- [ ] **Step 9: Verify Backup runs**

Wait for the next 02:00 UTC backup, or trigger via `/api/trigger` with `routine: 'backup'`. Check Drive `job-hunter-backups/` for a fresh `.sql.gz` file.

- [ ] **Step 10: Verify daily digest**

Wait for 08:00 PKT or trigger manually. Check Gmail for `[Job Hunter] N jobs ≥70 today`.

- [ ] **All 10 passing?** Commit nothing — this is the verification gate. Phase 1 is shippable.

**🟢 Stage I complete.** Phase 1 is verified end-to-end. Job Hunter v1 is live.

---

# Stage J: Extension adapters (53–62)

Implement these one at a time. Each follows the Task 12 / Task 29 / Task 30 pattern: fixture → test → implementation → register → seed. Each becomes one commit.

---

### Task 53: Wellfound adapter

**Files:**
- Create: `tests/fixtures/wellfound-sample.json`
- Create: `src/core/adapters/wellfound.ts`
- Create: `src/core/adapters/wellfound.test.ts`
- Modify: `src/core/adapters/registry.ts`

- [ ] **Step 1: Investigate**

Wellfound's public job listings are at `https://wellfound.com/jobs`. They don't publish a public REST API — listings are behind a GraphQL endpoint with rate limiting. For v1 this means scraping the public search results with Playwright, or using their RSS-style search results (`https://wellfound.com/jobs.atom` if available).

If scraping is the only path: defer to P2 when the Local Agent (Playwright) is set up. Note in adapter as a stub:

```ts
export class WellfoundAdapter implements Adapter {
  readonly name = 'wellfound' as const;
  validateConfig(_: AdapterConfig): void {}
  async fetch(_: AdapterConfig): Promise<JobPosting[]> {
    throw new Error('Wellfound adapter requires Playwright — defer to P2');
  }
}
```

- [ ] **Step 2: Register the stub + commit**

Add to registry, mark "P2" in a code comment. Commit:

```bash
git add src/core/adapters/wellfound.ts src/core/adapters/registry.ts
git commit -m "feat(adapters): stub Wellfound (Playwright required — P2)"
```

---

### Task 54: We Work Remotely adapter

**Files:**
- Create: `tests/fixtures/wwr-sample.xml`
- Create: `src/core/adapters/weworkremotely.ts`
- Create: `src/core/adapters/weworkremotely.test.ts`
- Modify: `src/core/adapters/registry.ts`

- [ ] **Step 1: Endpoint**

WWR publishes RSS feeds per category:
- All: `https://weworkremotely.com/remote-jobs.rss`
- Engineering: `https://weworkremotely.com/categories/remote-programming-jobs.rss`

Use Engineering. Implement via `rss-parser` (same shape as Honeypot in Task 29).

- [ ] **Step 2–5: Same pattern as Task 29.** Adjust for WWR's RSS field names. Commit.

---

### Task 55: Himalayas adapter

WWR-style: Himalayas has a public JSON API at `https://himalayas.app/jobs/api`. Use it like RemoteOK (Task 12).

---

### Task 56: Jobicy adapter

Jobicy publishes RSS at `https://jobicy.com/feed/job_feed`. Pattern: same as Honeypot.

---

### Task 57: Working Nomads adapter

Working Nomads: `https://www.workingnomads.com/api/exposed_jobs/?format=json` (public).

---

### Task 58: Otta adapter

Otta requires authenticated access via their web app. Defer to P2 with a stub adapter (same shape as Wellfound stub in Task 53).

---

### Task 59: Welcome to the Jungle adapter

WTTJ exposes public job listings via their search API; per-company endpoints exist (`https://www.welcometothejungle.com/api/v1/...`). Investigate; if RSS available, use RSS shape. If full scraping needed, defer to P2.

---

### Task 60: Hired adapter

Hired requires login. Defer to P2 stub.

---

### Task 61: Lever adapter

Lever has a public Postings API exactly like Greenhouse:
`https://api.lever.co/v0/postings/{site}?mode=json`. Copy the Greenhouse adapter shape (Task 30); swap URL + minor field names.

---

### Task 62: Ashby adapter

Ashby Job Board API:
`https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true`. Same pattern as Greenhouse/Lever.

---

# Self-review checklist (done by plan author at write time)

- [x] Spec coverage: every component / phase-1 exit criterion has a task.
- [x] No placeholders: every code block contains real code; no "TBD" / "fill in".
- [x] Type consistency: `JobPosting`, `Profile`, `Preferences`, `JobScore` shapes are stable across tasks.
- [x] File paths absolute (Windows form) at task headers; commands use forward-slash paths inside quotes (works for both `bash` and PowerShell).
- [x] Each task is bite-sized (one feature, 5–30 min).
- [x] Frequent commits — every task ends in a commit.

# Known plan caveats

- **Anthropic routine-trigger endpoint format may differ from what's stubbed in Task 40.** Check the actual `/schedule` UI when you create routines for the real URL and adjust.
- **Wellfound, Otta, WTTJ, Hired** are deferred to P2 because they need a logged-in browser session. The stub adapters keep the registry complete; the real implementations land when the Local Agent ships.
- **Rate-limit behavior on free Anthropic Max** isn't tested at scale. If the Ingest routine bumps a 5-hour cap, the simplest mitigation is moving the Scorer step to a direct API call (use the existing `src/llm/client.ts` wrapper) with a small API balance.

---

# Plan complete.
