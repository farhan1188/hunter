# Local test cycle

How to test the end-to-end pipeline locally using runner scripts, without deploying
or waiting for cloud routines. Iterate on prompts and see results in 30 seconds.

Related: [file-map](../file-map.md) | [tune-quality-gates](tune-quality-gates.md) | [components/tailoring](../components/tailoring.md)

---

## Why run locally

Cloud routines run on a cron schedule and are hard to observe. Runner scripts let you:

- Test a prompt change immediately without waiting 30 minutes for the next tailor cycle.
- See log output inline (not buried in Turso `routine_runs`).
- Iterate on a fixed batch of jobs instead of pulling new ones each time.
- Avoid burning Apify credits on repeated test runs.

---

## Cost

- Apify scrape: ~$0.05 per 25 LinkedIn jobs (once, to seed). No cost on subsequent
  tailor runs against already-ingested jobs.
- Anthropic API: ~$0.015 per tailored application (Haiku calls for cover letter +
  quality gates). Billed to `ANTHROPIC_API_KEY` in root `.env`.
- Typst render: free (local binary).

---

## Prerequisites

- `APIFY_API_TOKEN` in root `.env`.
- `ANTHROPIC_API_KEY` in root `.env`.
- Turso provisioned with migrations applied (`npm run db:migrate`).
- Typst on PATH: `typst --version` should return `0.14.2` or later.
- A resume and preferences saved in the `profile` table (do this via `/profile` in the Hub).

---

## Steps

### Step 1 — Ingest LinkedIn jobs

1. Pull a small batch of LinkedIn jobs via Apify and ingest into Turso:
   ```
   npm run ingest:linkedin -- --rows=5
   ```
   Expected output: lines like `fetched 5 items`, `inserted 5 jobs`, `qualified 3`.
   If you see `qualified 0`, your score threshold is too high or preferences are
   too narrow. Check `settings.score_threshold` in Turso (default 60).

2. Open http://localhost:3000/feed (start `npm run dev` first). You should see the
   new jobs. Check the visa tags and score values for sanity.

### Step 2 — Tailor the qualified applications

3. Run the local tailor script. It picks up to 5 qualified applications, generates
   artifacts, runs all three quality gates, and routes to `ready` or `quality_review`:
   ```
   npm run tailor
   ```
   Expected output: lines like `processing app <id> for <company>`,
   `gates: numerics=pass claim_equiv=pass verbatim_phrase=pass → ready`,
   or `gate failed: verbatim_phrase → quality_review`.

4. PDFs are written to `./tmp/` in the repo root. Open one to verify the resume
   renders correctly with tailored bullets.

### Step 3 — Inspect the pipeline

5. Open http://localhost:3000/pipeline. Applications should appear in the **Ready**
   or **Needs review** column.

6. Click into a Ready card. Check the **Cover letter** tab — read the generated letter.
   Check the **Quality gates** tab — all three gates should show `pass`.

7. Click into a Needs review card. Read the failure reason. This tells you which
   gate failed and why.

### Step 4 — Iterate on prompts (if needed)

8. To change the cover letter behaviour: edit the SYSTEM prompt at the top of
   `src/core/tailor/cover-letter.ts`. The prompt is a template literal starting
   with `You are a concise cover-letter writer...`.

9. To change the claim-equivalence gate sensitivity: edit the SYSTEM prompt in
   `src/core/quality/claim-equivalence.ts`. The key phrase is `soft drift counts as
   divergence` — relax or tighten from there.

10. To change the verbatim phrase selection: edit the SYSTEM prompt in
    `src/core/tailor/verbatim-phrase.ts`.

11. After changing a prompt, run the tailor script again on a fresh batch.
    First, ingest new jobs (step 1), or manually reset a few applications back to
    `qualified` via the Turso web console SQL tab:
    ```sql
    UPDATE applications SET state = 'qualified', tailor_retries = 0
    WHERE id IN ('<id1>', '<id2>');
    ```

12. Re-run tailor:
    ```
    npm run tailor
    ```

13. Repeat until the tray-vs-ready ratio looks healthy. A good target: ≥70% of
    qualified applications reaching `ready` without manual intervention.

### Step 5 — Run the agent on a Ready application

14. Ensure Job Hunter Chrome is running (see `workflows/run-local-agent.md`).

15. From the repo root:
    ```
    npm run agent
    ```
    The agent picks the oldest Ready/local_agent application and fills the form.

16. Review and submit manually in Chrome. Mark submitted in the Hub.

---

## Cleanup

17. Delete temp PDFs between test cycles if you want to keep `./tmp/` tidy:
    ```powershell
    Remove-Item ".\tmp\*.pdf"
    ```
    PDFs are listed in `.gitignore` — they will never be committed.

18. To reset the pipeline to a clean state for a new test run, dismiss all
    test applications from `/pipeline` or via SQL:
    ```sql
    UPDATE applications SET state = 'dismissed' WHERE state IN ('ready','quality_review','qualified');
    ```
