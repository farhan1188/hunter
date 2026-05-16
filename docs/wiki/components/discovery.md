# Discovery

Jobs enter the system through three streams: 9 direct adapters from Phase 1, HarvestAPI (LinkedIn via Apify), and paste-URL one-off import. All streams converge at the same ingest pipeline — archetype pre-filter → visa classification → scoring — before any `applications` row is created.

---

## Three discovery streams

| Stream | Source | Cadence | Entry point |
|---|---|---|---|
| Direct adapters | 9 job boards | Per ingest routine | `src/core/adapters/` |
| HarvestAPI | LinkedIn via Apify | Daily routine | `src/core/discovery/harvestapi-ingest.ts` |
| Paste-URL | User-provided URL | On demand | `src/core/discovery/import-url.ts` |

---

## Direct adapters

Nine adapters ship in Phase 1 and remain active in v1:

| Adapter name | Board |
|---|---|
| `remoteok` | RemoteOK |
| `honeypot` | Honeypot |
| `greenhouse` | Greenhouse (company slugs) |
| `lever` | Lever (company slugs) |
| `ashby` | Ashby (company slugs) |
| `himalayas` | Himalayas |
| `jobicy` | Jobicy |
| `workingnomads` | Working Nomads |
| `weworkremotely` | WeWorkRemotely |

### Adapter interface

Defined at `src/core/adapters/types.ts`:

```ts
interface Adapter {
  name: AdapterName;
  validateConfig(config: AdapterConfig): void;
  fetch(config: AdapterConfig): Promise<JobPosting[]>;
}
```

Each adapter owns parsing and normalisation only. Deduplication and persistence happen in the Ingest routine, not in the adapter.

### Registry pattern

`src/core/adapters/registry.ts` holds a `Partial<Record<AdapterName, Adapter>>` map. Routines call `getAdapter(name)` by the `name` field from the Turso `adapters` table. To add a new adapter: implement the interface, import it, add one line to `ADAPTERS`. See `docs/wiki/workflows/add-an-adapter.md` for the full checklist.

---

## HarvestAPI (LinkedIn via Apify)

LinkedIn is the highest-value discovery stream. It runs through Apify's no-cookies actor so the user's personal LinkedIn account is never touched.

### Actor

- Slug: `harvestapi/linkedin-job-search`
- Console actor ID: `zn01OAlzP853oqn4Z`
- Verified live 2026-05-14: 20-job test, full JD text on all 20, external apply URL on 19/20.

### Output schema

Key fields from each `HarvestApiItem` (`src/core/discovery/harvestapi-ingest.ts:4`):

| Field | Use |
|---|---|
| `id` | external ID (LinkedIn numeric) |
| `title`, `descriptionText` | job title + full JD |
| `linkedinUrl` | canonical listing URL |
| `applyMethod.companyApplyUrl` | preferred submit URL |
| `easyApplyUrl` | fallback if no external URL |
| `company.name` | company name |
| `applicantTrackingSystem` | ATS hint (goldmine field) |
| `location.countryCode` | ISO-3166 alpha-2, lowercase |

### ATS normalisation

`normalizeAts(value)` at `src/core/discovery/harvestapi-ingest.ts:32` maps `applicantTrackingSystem` to a canonical lowercase form. The map includes `greenhouse`, `lever`, `ashby`, `workday`, `smartrecruiters`, `linkedin`. Unknown values return `null`. This field auto-routes qualified jobs to Tier 1 (ATS-native submit) without URL-pattern probing.

### Transformation

`harvestApiToJobPosting(item)` at `src/core/discovery/harvestapi-ingest.ts:39` builds a `JobPosting`. `apply_url` priority: `companyApplyUrl ?? easyApplyUrl ?? linkedinUrl`.

### Cloud routine

`routines/harvestapi.md` — daily (cron `0 6 * * *`, 06:00 UTC = 11:00 PKT). POSTs to:

```
POST https://api.apify.com/v2/acts/zn01OAlzP853oqn4Z/run-sync-get-dataset-items
  ?token=$APIFY_API_TOKEN&clean=true&format=json
```

Requires `APIFY_API_TOKEN` and `TURSO_AUTH_TOKEN_HARVESTAPI` in env. Logs `{fetched, inserted, qualified, by_ats}` to `routine_runs`.

### Local-runner equivalent

```
npm run ingest:linkedin -- --rows=N
```

Runs `scripts/run-harvestapi.ts` directly against the Anthropic API. Useful for testing without deploying the cloud routine.

### Cost

20 jobs ≈ $0.04 (Apify compute + HarvestAPI pay-per-event at $1/1k). Projected 1,500–3,000 jobs/month fits inside Apify's $5/month free credit tier. Apify credit usage is logged in `routine_runs.stats_json`.

---

## Paste-URL one-off

**Route:** `POST /api/import-url` → `src/core/discovery/import-url.ts`

Flow:
1. Server-side `fetch(url)` — returns HTML.
2. `extractFromHtml(url, html)` parses OG tags (`og:title`, `og:description`) to extract title, company, and description. Title split on ` at `, ` @ `, ` - `, ` | ` separators.
3. Creates a `JobPosting` with `source = 'manual'`, `external_id = sha256(url).slice(0,16)`.
4. Runs `classifyVisa` → `scoreJob` synchronously.
5. If `score >= settings.score_threshold`: calls `createQualified`, returns `applicationId`.
6. Else: returns score to the UI which shows a toast "Score N below threshold; not qualifying."

The user gets redirected to the application detail page on qualification or stays on `/pipeline` with a toast on rejection.

---

## Ingest pipeline (shared by all streams)

### Archetype pre-filter

`src/core/ingest/archetype.ts` — batch Haiku classifier. Labels each job `match | maybe | mismatch` against the candidate's `target_roles`. Batch size: 20 titles per Haiku call. `mismatch` jobs are dropped before scoring, saving token budget. `maybe` jobs are kept.

### Visa classifier

`src/core/ingest/classify.ts` — Haiku call. Returns `{category, target_countries, target_timezone}`. Categories: `country_specific | sponsorship_offered | international_remote | unknown`. Used by the scoring function and governs whether a job qualifies based on the user's `work_auth_countries` preferences.

### Annotate batch helper

`src/core/ingest/annotate.ts` — `annotateUnclassified(db, limit)` re-runs the visa classifier on any `jobs` row with `visa_category = 'unknown'`. Called by the reconciler and available as the `/api/annotate` manual trigger.

---

## Deferred

Aggregator adapters (Wellfound, Otta, BuiltIn) are specified in the design doc but not yet implemented. They cover companies not well-indexed on LinkedIn. See [open-questions](../open-questions.md) and [decisions](../decisions.md) ADR-008.
