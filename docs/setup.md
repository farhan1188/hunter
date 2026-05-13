# Job Hunter — Setup

## Turso (one-time)

> **Note:** Turso doesn't ship a native Windows CLI — provision via the web console.
> The Hub talks to Turso over HTTP from `@libsql/client`, so no CLI is needed at runtime.

1. Go to https://app.turso.tech and sign up / log in.

2. **Create Database** → name `job-hunter` → pick the region closest to you
   (e.g. `aws-ap-south-1` for Mumbai if you're in Pakistan).

3. On the database's page, copy the **HTTP URL**
   (`libsql://job-hunter-<you>.turso.io`) → put in `.env` as `TURSO_DATABASE_URL`.

4. **Generate Token** → "Full access" → no expiration → copy → put in `.env` as
   `TURSO_AUTH_TOKEN_FULL` (used by Hub + migrations).

5. **Generate Token** again → "Read only" → no expiration → copy → put in `.env`
   as `TURSO_AUTH_TOKEN_READ` (used by Backup routine).

6. Copy `.env.example` → `.env` if you haven't already, with the values above filled in.

7. Apply migrations:

   ```bash
   npm run db:migrate
   ```

   Expected output: `APPLY 001_init.sql` then `Migrations complete.`

### Running ad-hoc SQL

You won't have `turso db shell` locally on Windows. Two options:
- Use the Turso web console (SQL tab on the database page)
- Install the CLI inside WSL if you have it (`curl -sSfL https://get.tur.so/install.sh | bash`)

The Backup routine uses `turso db shell ... .dump` but that runs on Anthropic's Linux
infrastructure where the CLI is available — not on your Windows machine.

## Anthropic API

Add your Anthropic API key to `.env` as `ANTHROPIC_API_KEY`. Used only for:
- One-shot resume extraction at upload time (~$0.05 per upload)
- Fallback scoring if routine Max usage hits a rate cap

## Google Drive (for resume backup, set up in Stage H)

See Task 43 in the implementation plan.

## Routine deployment

Once the code is up and Turso is provisioned:

1. In claude.ai, run `/schedule` and create routines using the prompts in `routines/`:
   - `ingest.md` — cron `0 */2 * * *` (every 2 hours)
   - `backup.md` — cron `0 2 * * *` (02:00 UTC nightly)
   - `reconciler.md` — cron `0 3 * * *` (03:00 UTC nightly)
   - `notify-digest.md` — cron `0 3 * * *` (08:00 PKT)

2. Capture the trigger endpoint URL + bearer from `/schedule` and put them in `.env`:
   ```
   ANTHROPIC_API_TRIGGER_URL=...
   ANTHROPIC_API_TRIGGER_TOKEN=...
   ```
