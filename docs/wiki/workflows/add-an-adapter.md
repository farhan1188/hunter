# Add an adapter

Pattern for adding a new job-source adapter so the platform can crawl a new site.
Follow these steps in order — skipping any of them leaves the adapter dead code.

Related: [file-map](../file-map.md) | [components/discovery](../components/discovery.md) | [conventions](../conventions.md)

---

## Decide: adapter vs Local Agent ingest

Before writing code, answer these questions:

- Does the site have a public JSON/RSS/GraphQL endpoint that returns job listings
  without authentication? → **Adapter** (this workflow).
- Does the site require signing in, or does it only expose jobs through a rendered
  page that needs a real browser? → **Local Agent ingest** — a different pattern not
  covered here; open an issue to design it first.

If you're unsure, check whether existing adapters cover the pattern:
- `src/core/adapters/greenhouse.ts` — JSON API, token-per-company pattern.
- `src/core/adapters/honeypot.ts` — GraphQL query.
- `src/core/adapters/remoteok.ts` — plain JSON feed, no auth.

---

## Steps

### 1. Create the adapter file

1. Create `src/core/adapters/<name>.ts`. Use the snake_case adapter name that will
   appear in the `adapters` DB table (e.g. `himalayas`, `weworkremotely`).

2. Implement the `Adapter` interface from `src/core/adapters/types.ts`:
   ```typescript
   export class <Name>Adapter implements Adapter {
     name: AdapterName = "<name>";

     async fetch(config: AdapterConfig): Promise<JobPosting[]> {
       // fetch from the source
       // parse into JobPosting[]
       // return the array
     }
   }
   ```
   The `fetch` method must return `JobPosting[]` or throw. It must not write to the
   database — persistence is handled by the ingest pipeline that calls it.

3. Use `makeJobId(source, externalId)` from `src/core/adapters/util.ts` for the
   `id` field. This generates the `sha256(source + '::' + externalId).slice(0,16)`
   fingerprint that prevents duplicates.

4. Use `nowIso()` from `src/core/adapters/util.ts` for `fetched_at`.

5. Always use `stripHtml(text)` from `src/core/adapters/util.ts` on any HTML
   description field before storing in `description_md`.

### 2. Add the name to the type union

6. Open `src/core/types.ts`. Find the `AdapterName` union. Add `"<name>"` to it:
   ```typescript
   export type AdapterName =
     | "remoteok"
     | "honeypot"
     | "<name>"   // ← add here
     | ...;
   ```

### 3. Register in the registry

7. Open `src/core/adapters/registry.ts`. Import your new class and add it to the
   registry map:
   ```typescript
   import { <Name>Adapter } from "./<name>.js";

   const registry: Record<AdapterName, Adapter> = {
     // existing entries...
     "<name>": new <Name>Adapter(),
   };
   ```

### 4. Write a test

8. Create `src/core/adapters/<name>.test.ts`.

9. Make one real HTTP request to the smallest endpoint the adapter hits, save the
   response body to `tests/fixtures/<name>-sample.html` (or `.json`).
   This is your golden fixture — tests run offline against it.

10. Write a test that calls `adapter.fetch(config)` with the fixture mocked via
    `vi.stubGlobal("fetch", ...)` or a `nock` intercept, and asserts:
    - The returned array has at least one item.
    - Each item has `id`, `title`, `company_name`, `url`, `apply_url`.
    - `id` is 16 hex characters.

11. Run the test:
    ```
    npm test -- <name>
    ```
    You should see `✓ <name> adapter` (or similar).

### 5. Seed the adapters table

12. Open the Turso web console (SQL tab at app.turso.tech). Run:
    ```sql
    INSERT OR IGNORE INTO adapters (name, enabled, config_json, submit_mode, daily_cap)
    VALUES ('<name>', 0, '{}', 'off', 5);
    ```
    `enabled = 0` means it won't crawl until you turn it on. `daily_cap = 5` is a
    safe default — `0` would block all submissions (see [gotchas](../gotchas.md)).

    Alternatively, the `/settings` UI will show the adapter once it's in the registry
    and you can enable it from there.

### 6. Update the ingest routine if needed

13. Open `routines/ingest.md`. If that routine hard-codes which adapters to run
    (rather than reading from the `adapters` table), add `<name>` to the list.
    If it reads `WHERE enabled = 1` from the registry, no change is needed.

### 7. Run migrations if you added columns

14. If your adapter stores adapter-specific config that requires a new column on
    `adapters`, add a new migration file:
    ```
    src/db/migrations/006_<descriptive_name>.sql
    ```
    Then run: `npm run db:migrate`
    Expected: `APPLY 006_<descriptive_name>.sql … Migrations complete.`

### 8. Final checks

15. Run the full test suite:
    ```
    npm test
    ```
    All existing tests must pass. No new failures allowed.

16. Commit:
    ```
    git add src/core/adapters/<name>.ts src/core/adapters/<name>.test.ts src/core/types.ts src/core/adapters/registry.ts tests/fixtures/
    git commit -m "feat(adapters): add <name> source"
    ```

17. Enable the adapter in `/settings` and watch the next ingest cycle for results.
