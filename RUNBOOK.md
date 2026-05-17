# Runbook: Job Hunter, day-to-day

A short guide for the human in front of the machine.

---

## The 10-second mental model

Three things happen, in order:

1. **Discover** — Apify pulls LinkedIn jobs. (Direct adapters — RemoteOK / Honeypot / etc. — run via `/feed` → **Fetch jobs**.)
2. **Tailor** — for any job that scores ≥ your threshold, Sonnet writes a cover letter referencing your real bullets and Typst renders a PDF.
3. **Send** — the agent opens each Ready job in your Job Hunter Chrome, fills the form, and either stops before Submit (default) or clicks it (if you've turned on Apply automatically).

One button on the Dashboard does all three end-to-end: **Run autonomous round**.

---

## Daily routine (2 minutes)

```
Open http://localhost:3004/dashboard
  → Click "Run autonomous round"
  → Watch the live log
  → When the round finishes, scan the Pipeline → Recent column
```

If you want to review each tailored letter first (recommended for the first week):

```
Settings → "Apply automatically" = OFF
Dashboard → Run autonomous round
Pipeline → click each Ready card → Read cover letter → click "Open in Chrome
  and fill the form" → review what's filled → click Submit yourself
```

Once you trust the output:

```
Settings → "Apply automatically" = ON
Dashboard → Run autonomous round
  → The agent now clicks Submit after each form is filled.
  → A screenshot is saved per submit under %TEMP%/job-hunter-submit-shots/
```

---

## Before the very first autonomous round

These are one-time setup confirmations.

### 1. Job Hunter Chrome must be running

The agent connects to a dedicated Chrome window via CDP on port 9222.

- Launch the **Chrome (Job Hunter)** shortcut on your desktop. (Setup: `agent/scripts/setup-chrome-cdp.md`.)
- The first time, sign into **LinkedIn** in that Chrome (and any other sites you'll want it to submit to — Workday, etc.).
- Cookies persist in the dedicated profile, so this is a once-per-site thing.
- Sanity check: open http://localhost:9222 in that Chrome — you should see a JSON handshake.

### 2. Settings to set once

- **Pause all sending** = OFF (it's ON by default for safety)
- **Daily submit cap** = 10 (your call — 0 means unlimited)
- **Weekly submit cap** = 30
- **Minimum match score to auto-apply** = 75 (default — raise for stricter, lower for volume)
- **Apply automatically** = OFF for the first round, ON after you trust it
- **Wait between auto-sends** = 30 (avoids looking spammy to ATS bot detection)

### 3. Sanity-run one manual round in fill-only mode

1. Settings → Apply automatically OFF
2. Dashboard → Run autonomous round
3. Watch the live log. Phases stream: `ingest → tailor → submit`.
4. After it finishes, open one Ready app in the Pipeline.
5. The Chrome window already has that form filled. Switch to it, review every field, click Submit.
6. If the application landed, mark it submitted via the app's Pipeline detail page (or the agent does this for you on success).

Once one round survives that sanity check, flip Apply-automatically ON.

---

## What the buttons actually do

| Button | What it does |
|---|---|
| **Dashboard → Run autonomous round** | Full pipeline. Calls `/api/run-round`. Equivalent to running `npm run ingest:linkedin && npm run tailor && npm run submit` in sequence. |
| **Pipeline → Run Agent** | Sends the *next* Ready application (without ingest/tailor). |
| **Pipeline → card → Open in Chrome and fill the form** | Sends *this* application specifically. |
| **Feed → Fetch jobs** | Crawl the 9 direct job boards (RemoteOK, Honeypot, Greenhouse, Lever, Ashby, Himalayas, Jobicy, WorkingNomads, WeWorkRemotely). |
| **Feed → Score new** | Score any unscored jobs against your profile. |
| **Feed → More → Re-score everything** | Wipe and re-rank ALL jobs. Use after changing the resume or preferences. |
| **Pipeline → Paste a job URL → Import** | Apply to any job not on the supported sources. Pastes the URL, the system fetches, tailors, queues. |

---

## When something doesn't work

| Symptom | Likely cause | Fix |
|---|---|---|
| "Run autonomous round" runs but Submit phase says 0 submitted | Job Hunter Chrome isn't open at port 9222 | Launch the Chrome (Job Hunter) shortcut |
| Workday job halts with "Workday SSO required" | You haven't signed into that company's Workday in this Chrome profile | Switch to that Chrome window, sign in, re-run |
| `apply_url` is the LinkedIn page URL (not the company site) | Job was ingested before this session's persist bug fix | Re-ingest the job (it'll resolve to companyApplyUrl now) |
| Cover letter mentions a number not in the resume | Bullet selection picked something with an unsourced digit | The quality check should catch this — if it didn't, raise the threshold or send to Skip |
| Pipeline shows no jobs | No fresh ingest in 24h | Dashboard → Run autonomous round (will pull a fresh batch first) |
| "No Easy Apply button on page" | The LinkedIn job redirects to an external form (no Easy Apply offered) | Re-ingest — the new code captures `companyApplyUrl` so future ingests can fill the external form directly |

---

## Cost expectations

Per autonomous round (5 rows × 3 titles × 3 locations = up to 45 jobs):
- Apify: ~$0.45
- Anthropic (scoring + tailoring + cover letters): ~$0.50-$1.00
- Total: **under $2 per round, 10-15 cover letters generated, 5-10 likely qualified**

Cap your `Daily AI budget (USD)` in Settings as a hard ceiling.

---

## Long-running operation

For hands-off "apply for me on a cadence":

```
# Run a round every hour:
#   - From any shell:
curl -X POST http://localhost:3004/api/run-round

#   - Or from a Windows scheduled task (recommended):
schtasks /Create /SC HOURLY /TN "JobHunterRound" /TR "curl -X POST http://localhost:3004/api/run-round"
```

Or use Claude Code's `/loop`:

```
/loop 1h curl -N -X POST http://localhost:3004/api/run-round
```

The endpoint streams progress as NDJSON if you want to watch.

---

## Files worth knowing

| File | Purpose |
|---|---|
| `RUNBOOK.md` | This file. |
| `docs/wiki/current-state.md` | What's working / blocked / deferred right now. |
| `docs/wiki/gotchas.md` | Non-obvious pitfalls and fixes. |
| `scripts/run-harvestapi.ts` | Manual LinkedIn ingest. |
| `scripts/run-tailor.ts` | Manual tailor pass. |
| `scripts/run-submit.ts` | Manual submit pass. |
| `app/api/run-round/route.ts` | The orchestrator endpoint. |
| `agent/src/submit-runner.ts` | The browser-driving submit agent. |
| `.env` | Apify token, Anthropic key, Typst path. |
| `agent/.env` | Turso scoped tokens for the agent. |

---

## What this platform won't do (yet, or by design)

- **Auto-submit Workday jobs that need SSO** — you sign in once per company.
- **Solve captchas** — those go to `submit_failed` with a screenshot.
- **Auto-DM hiring managers on LinkedIn** — draft-only forever, by design (auto-DMing burns your network).
- **Track response / interview rates** — deferred until you have ≥ 50 submissions for statistical signal.
- **Browse non-supported job boards** that don't have a direct adapter — use the **Paste URL** field for those.

---

## Platform reality (from a real live test, 3 submissions, May-17)

| Platform | Result | What we learned |
|---|---|---|
| **Custom careers (Cove)** | **SUBMITTED end-to-end**, no human touch | Simple HTML forms with standard `<label for="...">` markup work well with the generic filler. State machine moved to `submitted`, `submitted_at` recorded. |
| **Lever (System1)** | Failed — "couldn't verify success after submit" | Lever uses typeahead fields ("Current location", "Current company") that don't accept raw text. The agent typed values but Lever's form-validation rejected. Needs a Lever-specific filler that picks from the autocomplete dropdown. |
| **Custom careers (Electronic Arts)** | Failed — "no Submit button found" | jobs.ea.com has a multi-step flow with an interstitial "Sign in / Create account" page before the form, so the agent landed on a page with no Submit button. Workday-style fix needed. |

**Realistic expectations today:**
- **Greenhouse / Ashby / standard custom forms** likely work like Cove did
- **Lever's typeahead-heavy forms** need an enhanced filler (open issue)
- **Workday / EA / SAP SuccessFactors** need site-specific handlers (open issue)
- **Set `daily_cap` to something like 5** while you watch the success rate per round
- **Always check the audit screenshots** at `%TEMP%/job-hunter-submit-shots/` after the first few rounds — they're saved on every Submit attempt, success or fail

---

## Done. Go run a round.
