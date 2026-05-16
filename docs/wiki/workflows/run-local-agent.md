# Run Local Agent

Setting up the dedicated Chrome profile and running the Local Agent to fill Tier 2
application forms. The agent fills everything and stops — you click Submit manually.

Related: [components/local-agent](../components/local-agent.md) | [daily-loop](daily-loop.md) | [gotchas](../gotchas.md)

---

## Why a dedicated Chrome profile

Chrome silently drops `--remote-debugging-port` when you use the default profile
(a 2024 Google security mitigation). The CDP port only binds if Chrome is launched
with a separate `--user-data-dir`. This is the most common reason the agent fails
to connect. See [gotchas](../gotchas.md).

---

## One-time setup

### Create the Chrome profile directory

1. Open PowerShell and run:
   ```powershell
   mkdir "$env:USERPROFILE\chrome-cdp-profile"
   ```
   This creates `C:\Users\<you>\chrome-cdp-profile`. This directory stores cookies,
   sessions, and login state for the Job Hunter Chrome profile.

### Create the desktop shortcut

2. Right-click your desktop → **New** → **Shortcut**.

3. Set the **Target** field to (replace `<you>` with your Windows username):
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\<you>\chrome-cdp-profile"
   ```

4. Set the **Name** to `Chrome (Job Hunter)`. Click **Finish**.

5. Double-click the new shortcut to launch it. You should see a Chrome window with
   a banner reading "Chrome is being controlled by automated software" — that's normal.

### Sign into job sites in the dedicated profile

6. In the Job Hunter Chrome window, go to https://www.linkedin.com and sign in.
   Cookies are saved to the dedicated profile — you won't need to sign in again
   for future agent runs.

7. If you expect Workday applications: go to a Workday job page and sign into Workday
   Central (or create an account). The agent halts on Workday SSO interstitials and
   asks you to sign in manually; doing it once now saves time later.

### Verify CDP is working

8. While Job Hunter Chrome is open, open http://localhost:9222 in any browser tab
   (including regular Chrome). You should see a JSON response listing the open pages.
   If you see `ERR_CONNECTION_REFUSED`, the CDP port did not bind — see
   [gotchas](../gotchas.md) for fixes.

---

## Running the agent

### Pre-run checklist

9. Job Hunter Chrome shortcut is running. Verified by checking http://localhost:9222.

10. Root `.env` has `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN_FULL`.

11. `agent/.env` has `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_AGENT`, `CHROME_CDP_URL`,
    and all `PROFILE_*` fields (first name, last name, email, phone). See
    [setup-from-scratch](setup-from-scratch.md) step 16.

12. There is at least one application in state `ready` with `channel = 'local_agent'`
    in the pipeline. Check `/pipeline` → Ready column.

### Run from the Hub (recommended)

13. Open http://localhost:3000/pipeline in your browser.

14. Click **Run agent**. The button disables and shows a spinner.

15. The agent picks the oldest Ready/local_agent application, opens the apply URL
    in a new tab in Job Hunter Chrome, and fills all visible fields.

16. When the agent finishes, the button re-enables and shows the result. If it
    succeeded, switch to Job Hunter Chrome.

### Run from the terminal (alternative)

13. From the repo root, run:
    ```
    npm run agent
    ```
    Output is streamed to the terminal. The agent exits when it's done.

---

## After the agent runs

17. Switch to the Job Hunter Chrome window. You should see the application form with
    all fields filled. The Submit button is outlined in red.

18. Review every filled field carefully:
    - Name and contact details match your actual details.
    - Resume PDF is attached.
    - Cover letter text is in the correct field.
    - Any custom questions are answered.

19. Fix anything incorrect by editing the field directly in the browser.

20. Click **Submit** in Chrome.

21. Return to the Hub. Go to `/pipeline/[id]` for that application. Click
    **Mark as submitted**. The state moves from `ready` to `submitted`.

22. To process the next application in the queue, repeat from step 13.

---

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED` connecting to localhost:9222 | CDP port didn't bind | Launch Job Hunter Chrome shortcut; verify no other Chrome is running with the same profile. See [gotchas](../gotchas.md). |
| Agent picks wrong Chrome instance | Another Chrome is bound to port 9222 | Run `netstat -ano \| findstr :9222` in PowerShell; kill the process holding that port; re-launch the shortcut. |
| Agent halts with "Workday SSO detected" | Workday asks for login | Sign into Workday manually in Job Hunter Chrome, then run the agent again. |
| Agent halts with "unknown required field" | A form field has no match in the Q&A KB | Add an answer in `/settings` → Q&A KB, then re-queue the application (dismiss and re-submit or re-qualify manually). |
| Cover letter not pasted | The textarea selector didn't match | File the URL pattern as a bug. As a workaround, paste `applications.cover_letter_md` manually from `/pipeline/[id]`. |

For more, see [gotchas](../gotchas.md).
