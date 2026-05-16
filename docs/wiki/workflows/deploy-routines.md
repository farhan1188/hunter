# Deploy routines

How to deploy the three core cloud routines (`harvestapi`, `tailor`, `submit`) via
`/schedule` on claude.ai. These routines run on Anthropic infrastructure on a cron
schedule and never touch your local machine.

Related: [architecture](../architecture.md) | [setup-from-scratch](setup-from-scratch.md) | [components/discovery](../components/discovery.md)

---

## Before you start

- Turso is provisioned and migrations are applied (`npm run db:migrate`).
- Your root `.env` has `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_FULL`, and `APIFY_API_TOKEN`.
- You have access to claude.ai with a Claude Code Max subscription.

---

## Open /schedule

1. Open a regular browser window (your everyday Chrome — **not** the Job Hunter Chrome
   shortcut with CDP enabled).

2. Go to https://claude.ai and sign in.

3. Type `/schedule` in the message input and press Enter. The Schedule interface opens.

---

## Deploy: harvestapi routine

The harvestapi routine pulls LinkedIn jobs via Apify once a day.

4. Open `routines/harvestapi.md` in your editor. Select all (Ctrl+A) and copy.

5. In the `/schedule` interface, create a new routine. Paste the copied text as the
   prompt.

6. Set the cron expression to: `0 6 * * *`
   (runs daily at 06:00 UTC, which is 11:00 PKT).

7. Set environment variables for this routine:
   ```
   TURSO_DATABASE_URL=<same value as your root .env>
   TURSO_AUTH_TOKEN_HARVESTAPI=<see note below>
   APIFY_API_TOKEN=<your Apify personal API token>
   ```

   **Token note:** For maximum security, generate a scoped Turso token with write
   access to `jobs` and `applications` and read access to `profile` and `settings`
   (via Turso web console → your database → Tokens). Store it as
   `TURSO_AUTH_TOKEN_HARVESTAPI`. For v1 simplicity, you can also use
   `TURSO_AUTH_TOKEN_FULL` here — less secure but works.

8. Save the routine. Copy the **API trigger URL** and **bearer token** that appear
   after saving — paste them into root `.env` as:
   ```
   ANTHROPIC_API_TRIGGER_URL_HARVESTAPI=<url>
   ANTHROPIC_API_TRIGGER_TOKEN_HARVESTAPI=<bearer>
   ```

---

## Deploy: tailor routine

The tailor routine picks qualified applications, produces a tailored PDF resume and
cover letter, runs quality gates, and routes to `ready` or `quality_review`.

9. Open `routines/tailor.md` in your editor. Copy entire contents.

10. In `/schedule`, create a new routine with the copied text as the prompt.

11. Set the cron expression to: `*/30 * * * *` (every 30 minutes).

12. Set environment variables:
    ```
    TURSO_DATABASE_URL=<same as root .env>
    TURSO_AUTH_TOKEN_TAILOR=<scoped token with read/write on applications; or TURSO_AUTH_TOKEN_FULL>
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH=<path to your Drive service account JSON, if using Drive>
    GOOGLE_DRIVE_FOLDER_ID=<Drive folder id for PDF uploads, if using Drive>
    ```

13. Save the routine.

---

## Deploy: submit routine

The submit routine auto-submits Tier 1 applications (Greenhouse/Lever/Ashby) using
Playwright MCP. This routine is the most sensitive — it sends real job applications.

14. Open `routines/submit.md` in your editor. Copy entire contents.

15. In `/schedule`, create a new routine with the copied text as the prompt.

16. Set the cron expression to: `*/15 * * * *` (every 15 minutes).

17. Set environment variables:
    ```
    TURSO_DATABASE_URL=<same as root .env>
    TURSO_AUTH_TOKEN_SUBMIT=<scoped token with read/write on applications and adapters; or TURSO_AUTH_TOKEN_FULL>
    ```

18. Save the routine.

19. **Important:** do NOT turn off `submission_paused` yet. Leave it ON in
    `/settings`. The submit routine will check this kill switch and exit early if
    it's set. You want to watch at least one full tailor cycle complete and review
    2–3 Ready cards before enabling live submissions.

---

## Seed with data immediately

20. After saving all three routines, manually trigger harvestapi to pull your first
    batch of LinkedIn jobs without waiting until 06:00 UTC tomorrow.

21. In `/schedule`, find the harvestapi routine and click **Run now** (or use the
    trigger URL from step 8 with a `curl` or Postman call).

22. Wait 2–3 minutes. Refresh `/dashboard`. You should see jobs appearing in the feed
    and new applications created (state = `qualified`).

23. If `/dashboard` still shows zero jobs after 5 minutes, check:
    - `routine_runs` table in Turso (SQL tab at app.turso.tech) for `ok=0` rows with
      an `error` value.
    - That `APIFY_API_TOKEN` is correct (test at https://console.apify.com/account/integrations).

---

## After first tailor cycle completes

24. Wait for the tailor routine to run (up to 30 minutes). Open `/pipeline`.

25. Check what landed in **Ready** vs **Needs review**. Click into 2–3 Ready cards.
    Read the cover letters. Check the quality gates tab.

26. Only once the quality looks acceptable: go to `/settings` and flip
    `submission_paused` to **OFF**. The submit routine will start auto-submitting
    Tier 1 applications on its next 15-minute cycle.
