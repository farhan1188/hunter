# Daily loop

What a typical day looks like once the platform is live. Budget 15–20 minutes per day.

Related: [run-local-agent](run-local-agent.md) | [components/submission](../components/submission.md) | [data-model](../data-model.md)

---

## Overview

The cloud routines handle all the discovery and tailoring automatically. Your daily
job is to review what surfaced, run the Local Agent for Tier 2 applications, and
optionally queue outreach drafts for anything you submitted.

---

## Steps

### 1. Check overnight stats (2 minutes)

1. Open http://localhost:3000 (start `npm run dev` first if the server isn't running).
   You land on `/dashboard` automatically.

2. Read the stat cards at the top:
   - **Submitted 24h** — how many went out automatically via Tier 1 (Greenhouse/Lever/Ashby).
   - **Apps created 24h** — new qualified applications from overnight HarvestAPI run.
   - **Needs review** — applications stuck in `quality_review` waiting for your call.
   - **Routine health** — red badges here mean a routine hasn't run recently; check
     [gotchas](../gotchas.md) if you see this.

3. Scan the 7-day funnel to see whether your qualify → ready → submitted conversion
   rate looks healthy. A good ratio is roughly 40% qualify→ready, 80% ready→submitted.

---

### 2. Triage the Needs Review column (5–10 minutes)

4. Open `/pipeline`. Look at the **Needs review** column.

5. For each card in Needs review, click into it to open `/pipeline/[id]`.

6. On the detail page, read the **Quality gates** tab. You'll see which gate failed
   and the reason — e.g. `numerics: Bullet contains digit run '2022' not in source numbers[]`
   or `verbatim_phrase: no company artifact`.

7. Decide:
   - If the failure is a false positive (e.g. a date range triggering the numerics gate)
     → click **Accept / move to Ready**. The application queues for submission.
   - If the failure reflects a real quality issue (e.g. the cover letter is generic)
     → click **Dismiss**. The application moves to `dismissed` (terminal).

8. Repeat for all Needs review cards. Aim to clear the tray daily — stale cards pile up.

---

### 3. Run the Local Agent for Tier 2 applications (5–10 minutes)

9. Open `/pipeline`. Look at the **Ready** column for cards labeled **local_agent channel**.

10. Before running the agent, make sure Job Hunter Chrome is open. Launch the desktop
    shortcut named **Chrome (Job Hunter)** if it's not already running.
    Verify: open http://localhost:9222 in any tab of that Chrome and you should see a
    JSON page listing protocol info.

11. On `/pipeline`, click **Run agent**. The agent picks the oldest Ready/local_agent
    application, opens the apply page in Chrome, fills all fields, and outlines the
    Submit button in red.

12. Switch to Chrome. Review the filled form — check your name, email, cover letter text,
    and resume attached. If anything looks wrong, fix it manually.

13. Click **Submit** in Chrome.

14. Return to the Hub. Open `/pipeline/[id]` for that application. Click
    **Mark as submitted**. The application moves to `submitted`.

15. Repeat steps 11–14 until the Ready/local_agent column is empty.
    Each run picks one application. Running again picks the next one.

---

### 4. Optional — queue outreach drafts (2 minutes)

16. For any application that just moved to `submitted`, click into its detail page.

17. Open the **Outreach** tab. Click **Draft LinkedIn DM**.
    The system generates a 75–100 word message in `outreach_drafts`.

18. Click **Copy**. Paste into LinkedIn's message composer and send manually.
    (Auto-sending is intentionally not supported — see [decisions](../decisions.md) ADR-007.)

---

## Signs something is wrong

- **No new apps created 24h** → HarvestAPI routine may have failed. Check `/dashboard`
  routine health. Check `routine_runs` in Turso for `ok=0` rows.
- **Submitted count is 0 for days** → Check that `submission_paused` is OFF in
  `/settings`. Check that at least one adapter has `submit_mode = 'auto_submit'` and
  `daily_cap > 0`.
- **Agent fails immediately** → Chrome CDP port 9222 may not be bound. See
  [run-local-agent](run-local-agent.md) and [gotchas](../gotchas.md).
