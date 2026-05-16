# Setup from scratch

End-to-end install on a fresh Windows machine. Takes about 30 minutes.

Related: [architecture](../architecture.md) | [deploy-routines](deploy-routines.md) | [run-local-agent](run-local-agent.md)

---

## Prerequisites

- Windows 10/11
- Git installed
- Node.js 20+ installed
- Google Chrome installed
- A claude.ai account with Claude Code Max (used for cloud routines)

---

## Steps

### Clone and install

1. Open PowerShell. Clone the repo:
   ```
   git clone https://github.com/farhan1188/hunter.git
   cd hunter
   ```

2. Install root project dependencies:
   ```
   npm install
   ```
   You should see a `node_modules/` directory appear in the repo root.

3. Install agent dependencies:
   ```
   cd agent
   npm install
   cd ..
   ```

4. Install Typst (resume rendering engine):
   ```
   winget install Typst.Typst
   ```
   After install, **close and reopen PowerShell** — PATH changes don't propagate to the running shell.
   Verify: `typst --version` should print `typst 0.14.2` (or later).

---

### Provision Turso (hosted database)

> Turso has no Windows CLI. Provision entirely via the web console.

5. Go to https://app.turso.tech and create an account (or sign in).

6. Click **New database** → name it `job-hunter` → choose the region nearest you
   (e.g. `aws-ap-south-1` for Pakistan/South Asia). Click **Create database**.

7. On the database page, copy the **HTTP URL** (format: `libsql://job-hunter-<you>.turso.io`).
   You'll paste this into `.env` as `TURSO_DATABASE_URL`.

8. Click **Generate token** → select **Full access** → no expiration → click **Generate**.
   Copy the token. This is `TURSO_AUTH_TOKEN_FULL`.

9. Click **Generate token** again → select **Read only** → no expiration → click **Generate**.
   Copy the token. This is `TURSO_AUTH_TOKEN_READ`.

See `docs/setup.md` for more detail on the Turso provisioning steps.

---

### Get an Apify token (LinkedIn job scraping)

10. Go to https://console.apify.com and create an account (or sign in).

11. Click your avatar → **Account** → **Integrations**. Copy the **Personal API token**.
    This is `APIFY_API_TOKEN`.

---

### Configure environment

12. Copy the example env file:
    ```
    copy .env.example .env
    ```

13. Open `.env` in any text editor. Fill in the following:
    ```
    TURSO_DATABASE_URL=libsql://job-hunter-<you>.turso.io
    TURSO_AUTH_TOKEN_FULL=<token from step 8>
    TURSO_AUTH_TOKEN_READ=<token from step 9>
    ANTHROPIC_API_KEY=<your Anthropic API key>
    APIFY_API_TOKEN=<token from step 11>
    ```
    Optional — only needed if you want resume PDFs backed up to Drive:
    ```
    GOOGLE_SERVICE_ACCOUNT_KEY_PATH=<path to service account JSON>
    GOOGLE_DRIVE_FOLDER_ID=<folder id>
    ```

---

### Run migrations

14. Apply the database schema:
    ```
    npm run db:migrate
    ```
    Expected output ends with `Migrations complete.` — you should see lines like
    `APPLY 001_init.sql`, `APPLY 002_last_seen.sql`, … `APPLY 005_qa_deny_list.sql`.

---

### Configure the Local Agent

15. Copy the agent env file:
    ```
    copy agent\.env.example agent\.env
    ```

16. Open `agent/.env` and fill in:
    ```
    TURSO_DATABASE_URL=libsql://job-hunter-<you>.turso.io
    TURSO_AUTH_TOKEN_AGENT=<use TURSO_AUTH_TOKEN_FULL for now; generate a scoped token later>
    CHROME_CDP_URL=http://localhost:9222
    PROFILE_FIRST_NAME=<your first name>
    PROFILE_LAST_NAME=<your last name>
    PROFILE_EMAIL=<your email>
    PROFILE_PHONE=<your phone number>
    PROFILE_LINKEDIN=<your LinkedIn profile URL>
    PROFILE_GITHUB=<your GitHub profile URL, or leave blank>
    ```

---

### Set up the Job Hunter Chrome profile

17. Create the dedicated Chrome profile directory:
    ```
    mkdir "$env:USERPROFILE\chrome-cdp-profile"
    ```

18. Create a desktop shortcut. Right-click desktop → **New** → **Shortcut**.
    Set Target to:
    ```
    "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\chrome-cdp-profile"
    ```
    Name it **Chrome (Job Hunter)**.

19. Launch the shortcut. In that Chrome window, sign into LinkedIn. Cookies persist
    in the profile directory — you won't need to sign in again.

See `workflows/run-local-agent.md` for full agent-running instructions.

---

### Deploy cloud routines

20. Deploy the three core routines (`harvestapi`, `tailor`, `submit`) via `/schedule` on claude.ai.

See `workflows/deploy-routines.md` for step-by-step instructions.

---

### Start the Hub

21. Start the development server:
    ```
    npm run dev
    ```
    Open http://localhost:3000 in your browser. You should land on `/dashboard`.

22. Go to `/profile`. Upload your resume PDF. Fill in your preferences
    (target roles, countries, salary expectations). Click **Save**.

23. Go to `/settings`. Enable at least two adapters to start. Recommended:
    - **RemoteOK** (no auth; good for sanity-checking the pipeline)
    - **Greenhouse** with a company token like `gitlab` in config_json
    Set `daily_cap` on each adapter to `5` (not 0 — 0 blocks all submissions;
    see [gotchas](../gotchas.md)).

24. Verify the dashboard shows job counts increasing over the next few hours as the
    harvestapi routine pulls LinkedIn jobs. If you want results immediately, manually
    trigger the harvestapi routine (see `workflows/deploy-routines.md`).
