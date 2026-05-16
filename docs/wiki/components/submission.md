# Submission

Submission runs on two tiers. Tier 1 is the cloud routine that auto-submits to Greenhouse / Lever / Ashby. Tier 2 is the Local Agent — a local Playwright process the user triggers to fill forms and stop at the Submit button. Both tiers share the cadence governor, daily caps, and Q&A deny-list enforcement. See [decisions](../decisions.md) ADR-006 for why two tiers exist.

---

## Tier 1 — ATS-native auto-submit

**Routine:** `routines/submit.md` — every 15 minutes (`*/15 * * * *`).

### Eligibility

```sql
WHERE a.state = 'ready'
  AND a.channel = 'ats_native'
  AND a.ats_vendor IN ('greenhouse','lever','ashby')
  AND ad.submit_mode = 'auto_submit'
  AND settings.submission_paused = 0
```

LinkedIn-discovered jobs with a known ATS vendor are routed here if the corresponding adapter's `submit_mode = 'auto_submit'`. The `apply_url` field (set by HarvestAPI, pointing at the company's ATS page rather than the LinkedIn listing) is used as the submit target — not `jobs.url`.

### Per-vendor Playwright recipes

Defined in `routines/submit.md`:

| Vendor | Apply URL pattern | Resume input | Cover letter |
|---|---|---|---|
| Greenhouse | `greenhouse.io/<slug>/jobs/<id>` | `<input id="resume">` | `<textarea name="cover_letter">` |
| Lever | `jobs.lever.co/<slug>/<id>/apply` | `<input type="file" name="resume">` | `<textarea name="comments">` |
| Ashby | `jobs.ashbyhq.com/<slug>/<uuid>/application` | File input near "Resume*" label | `contenteditable` near "Cover Letter*" |

v1 ships Greenhouse first; Lever and Ashby are added in Stage 8/9.

### Outcome transitions

| Result | New state | Side effect |
|---|---|---|
| Success page detected | `submitted` | `submitted_at = now()`, `adapters.last_submit_at = now()` |
| Failure | `submit_failed` | `failure_reason`, `failure_screenshot_path` set |
| Q&A deny-list match | `quality_review` | `failure_reason = 'Q&A deny-list: <pattern>'` |

---

## Tier 2 — Local Agent (click-to-send)

The Local Agent handles everything not covered by Tier 1: `submit_mode = 'click_to_send'` ATS rows, Workday, LinkedIn Easy Apply, and generic career pages. See [local-agent](local-agent.md) for the full implementation detail.

The agent fills the form and **stops at the Submit button** — the user clicks. After clicking, the user marks the application submitted via the Hub's "Mark as submitted" button on the application detail page.

---

## Cadence governor

`src/core/submit/cadence.ts` — `shouldSubmitNow(input: CadenceInput): CadenceResult`.

Used by Tier 1 only (auto-submit). Three checks run in order:

### 1. Local-hour gate

```ts
const hour = now.toLocaleString("en-US", { timeZone: timezone, hour12: false, hour: "2-digit" });
if (hour < 9 || hour >= 22) return { ok: false, reason: "outside waking hours" };
```

Submissions only fire 09:00–22:00 in the user's timezone (`Asia/Karachi` by default, or `settings.target_timezone`).

### 2. Daily cap gate

```ts
if (dailyCap === 0) return { ok: false, reason: "daily cap is 0 (footgun guard)" };
if (last24h >= dailyCap) return { ok: false, reason: "daily cap reached" };
```

`dailyCap = 0` is refused explicitly — it would mean "unlimited" and is treated as a misconfiguration.

### 3. Poisson cadence gate

Gap since last submission is sampled from an Exponential distribution:

```
rate = dailyCap / 24h (per minute)
minGap = samplePoissonGap(rate) × 0.5
```

`samplePoissonGap(rate)` uses inverse-CDF: `-ln(1-U)/rate`. If the time since `adapters.last_submit_at` is less than `minGap`, the attempt is skipped. This produces natural-looking submission spacing rather than a uniform cluster.

---

## Cap helpers

`src/core/submit/caps.ts`:

```ts
submittedLast24h(db, adapterName?)  // → count of submissions in last 24h, optionally per-source
submittedLast7d(db)                  // → count in last 7 days
```

Per-source counts join `applications` + `jobs` on `source = adapterName OR ats_vendor = adapterName`.

---

## Q&A deny-list halt

Before any form field is filled, every visible question label is checked against `qa_kb WHERE deny_list = 1`. Any match halts the submission attempt immediately:

- State transitions to `quality_review`.
- `failure_reason = 'Q&A deny-list: <matched_pattern>'`.
- No form data is submitted.

The user reviews the flagged question in the quality_review tray. See [qa-kb](qa-kb.md) for the full deny-list pattern list and the user workflow for non-sensitive answers.

---

## Mid-batch kill switch

The Submit routine re-reads `settings.submission_paused` between each row — not just at run start. If the user flips the global pause toggle while a batch is in flight, submission halts after the current application completes. No application mid-fill is abandoned.

---

## `submit_failed` is terminal-ish

`submit_failed` is a terminal state with no auto-retry. The failure screenshot is stored at `applications.failure_screenshot_path`.

The user can re-queue a failed application via the Hub UI: `POST /api/applications/[id]/retry` transitions state back to `ready`. A new submission attempt starts from scratch; the old failure record is preserved in `failure_reason`.

---

## Global submission kill switch

`settings.submission_paused = 1` (default). The Submit routine checks this at startup and exits immediately with a log entry if set. Flip to `0` in `/settings` to enable auto-submits. The Settings page shows a prominent banner when paused.

If `submit_mode = 'auto_submit'` is set on any adapter but `daily_cap = 0`, the routine refuses to run that source and logs a warning. The Settings UI surfaces this as a red banner.
