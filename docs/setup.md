# Job Hunter — Setup

## Turso (one-time)

1. Install the CLI on Windows (PowerShell):

   ```powershell
   irm get.tur.so/install.ps1 | iex
   ```

2. Sign up + log in:

   ```bash
   turso auth signup
   # or, if you have an account:
   turso auth login
   ```

3. Create the database:

   ```bash
   turso db create job-hunter
   ```

4. Capture connection info:

   ```bash
   turso db show job-hunter --url
   # → libsql://job-hunter-<user>.turso.io  -> put in .env as TURSO_DATABASE_URL

   turso db tokens create job-hunter --expiration none
   # → eyJ...   -> put in .env as TURSO_AUTH_TOKEN_FULL (used for migrations + Hub)

   turso db tokens create job-hunter --read-only --expiration none
   # → eyJ...   -> put in .env as TURSO_AUTH_TOKEN_READ
   ```

5. Copy `.env.example` → `.env` and paste the values in.

6. Apply migrations:

   ```bash
   npm run db:migrate
   ```

   Expected output: `APPLY 001_init.sql` then `Migrations complete.`

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
