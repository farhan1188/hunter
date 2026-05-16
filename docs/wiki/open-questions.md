# Open questions

Known unknowns and things to revisit. When a question is resolved, mark it with an **Update** line. When a new question surfaces, append it.

Related: [current-state](current-state.md) | [decisions](decisions.md) | [architecture](architecture.md)

---

## Will HarvestAPI's free $5/month credit cover steady-state volume?

**Why it matters:** If Apify costs exceed $5/month, we need a fallback actor or a budget increase. Our daily LinkedIn discovery run pulls up to 25 jobs. At $1/1k results, that's $0.025/day → ~$0.75/month — well inside the free tier at current volume. But if we increase `maxItems` or run more searches, we could exceed it.

**What we'd need to answer it:** Run the harvestapi routine for 30 days. Check the Apify dashboard for actual credit usage. Compare against projected $0.75/month.

**Update:** _TBD: not yet measured in production (routine not yet deployed)._

---

## Will the claim-equivalence judge flag too aggressively on real bullets?

**Why it matters:** The judge (Haiku) is intentionally strict — "soft drift counts as divergence." If it flags most bullets as non-equivalent, the `quality_review` tray fills up and the automation value drops. If it's too lenient, hallucinated claims slip through.

**What we'd need to answer it:** Run the tailor routine against 20-30 real qualified applications. Check what fraction land in `quality_review` due to `claim_equiv: fail` vs `numerics: fail` vs `verbatim_phrase: fail`. Adjust the system prompt strictness or the `quality_review_failure_mode` setting if needed.

**Update:** _TBD: waiting for first live production run._

---

## Does the Submit routine handle Greenhouse forms with custom company-specific questions?

**Why it matters:** Many companies add non-standard questions to their Greenhouse forms (e.g. "Why do you want to work at [Company]?", "What's your expected start date?"). The deny-list catches the sensitive ones; the KB handles pre-answered ones. But novel questions with `required = true` halt the submission and route to `quality_review`.

**What we'd need to answer it:** Submit to 5-10 Greenhouse applications and observe: how often does an unknown required question halt? What's the question distribution? Over time, the user fills the KB and the halt rate should drop.

**Update:** _TBD: no Tier 1 auto-submits have run yet. `submission_paused = 1`._

---

## Does Workday SSO actually work via Local Agent for all the user's targeted companies?

**Why it matters:** The user deferred Workday SSO automation (ADR notes: "Local Agent halts on Workday SSO; user signs in once in Job Hunter Chrome and re-runs"). But this assumes the dedicated Chrome profile can maintain Workday sessions across companies. In practice, some Workday tenants use different auth providers that may re-challenge.

**What we'd need to answer it:** Sign into 3-4 Workday tenants in the Job Hunter Chrome profile. Run the agent against them. Observe whether SSO sessions persist between runs.

**Update:** _TBD: no Workday submissions tested yet._

---

## Should we add an "Ingest now" button to the Hub like we have "Run agent"?

**Why it matters:** The "Run agent" button on `/pipeline` lets the user trigger the Local Agent from the UI without switching to a terminal. The same pattern could work for the harvestapi + tailor equivalents: trigger `npm run ingest:linkedin` and `npm run tailor` from the Hub. This would make the "morning check" workflow entirely UI-driven.

**What we'd need to answer it:** Determine whether the benefit (no terminal context switch) outweighs the cost (two more `child_process.spawn` API routes + UI buttons + streaming output). The local runner scripts already exist (`scripts/run-harvestapi.ts`, `scripts/run-tailor.ts`); wiring them to API routes is low complexity.

**Update:** _TBD: not prioritized. Terminal commands work for now._

---

## Should we add aggregator adapters (Wellfound / Otta / BuiltIn)?

**Why it matters:** HarvestAPI covers LinkedIn. The 9 direct adapters cover RemoteOK, Honeypot, Greenhouse/Lever/Ashby job boards, Himalayas, Jobicy, WorkingNomads, WeWorkRemotely. There may be relevant jobs on Wellfound (startup-focused) or Otta/BuiltIn (US-focused tech) that we're missing.

**What we'd need to answer it:** After 30 days of live operation, check: (a) how many qualified applications are being generated per day, (b) does the pipeline feel thin (fewer than N new `qualified` rows per day?), (c) are there specific companies the user notices on Wellfound that aren't appearing?

**Trigger for action:** If qualified applications/day < 3 sustained for 2 weeks, add one aggregator adapter. `AdapterName` union already includes `wellfound`, `otta`, `wttj`, `hired` — no type changes needed, just implement the adapter class.

**Update:** _TBD: deferred pending live data._

---

## Hunt-outcome schema: what shape when we hit 50 submissions?

**Why it matters:** We're tracking `submitted` state but not tracking what happens next: recruiter reply, phone screen, rejection, offer. Once volume is ≥50, this data becomes analytically useful for measuring which job sources, ATS vendors, or score ranges convert to interviews.

**What we'd need to answer it:** Design a minimal `application_events` table or add outcome columns to `applications`. Candidate schema:
```sql
CREATE TABLE application_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'recruiter_reply' | 'phone_screen' | 'rejection' | 'offer' | 'ghosted'
  occurred_at TEXT NOT NULL,
  notes TEXT
);
```
Or simpler: add `outcome TEXT` + `outcome_at TEXT` to `applications`. Decide when volume justifies the build.

**Update:** _TBD: deferred per ADR-010 until ≥50 submissions._

---

## The Tailor routine picks 8 best original bullets — when does real rewriting earn its complexity?

**Why it matters:** v1 `selectBullets()` uses deterministic lexical ranking (no LLM) to pick the 8 most JD-relevant bullets from the user's resume. These bullets are NOT rewritten — they go into the resume verbatim. This is safe (no hallucination risk) but may produce weaker tailoring than rewritten bullets.

**What we'd need to answer it:** After reviewing 20+ tailored resumes, assess: do the selected bullets feel well-matched, or do they often miss an obvious connection to the JD? If reviewers consistently want to rewrite bullets before approving, add a rewrite step (Haiku call per bullet + claim-equiv gate to verify fidelity).

**Complexity cost:** Rewriting adds LLM calls per bullet (8 calls per application), increases the claim-equiv gate load, and makes the `tailor` routine significantly more expensive. Not worth it if selection alone is satisfactory.

**Update:** _TBD: pending first batch of real tailored resumes._

---

## Should there be a "Tailor now" UI button parallel to "Run agent"?

**Why it matters:** The "Run agent" button lets the user trigger Tier 2 submission from the UI. There's no equivalent for tailoring — the user must run `npm run tailor` in a terminal or wait for the cloud routine. An "Tailor now" button would trigger `scripts/run-tailor.ts` via a child process, same pattern as `POST /api/agent/run`.

**What we'd need to answer it:** Evaluate how often the user wants to trigger tailoring outside the 30-minute cron window (e.g., after pasting a URL and wanting the application ready immediately). If this is a common need, the button is worth building.

**Update:** _TBD: not prioritized. `npm run tailor` works as the stopgap._

---

## Is the `APIFY_API_TOKEN` present in root `.env`?

**Why it matters:** `current-state.md` notes this as a blocker: `grep -c '^APIFY_API_TOKEN=' .env` returned 0. Without it, `npm run ingest:linkedin` fails and the harvestapi routine can't authenticate to Apify.

**What we'd need to answer it:** User verifies the token is in root `.env`. If missing, paste it from `apify.com/account/integrations`.

**Update:** _TBD: unverified as of 2026-05-16. User action needed._

---

## Is the Typst CLI available in the Anthropic cloud routine environment?

**Why it matters:** The Tailor routine calls `typst compile` via `child_process.spawn`. This works locally (v0.14.2 installed). But cloud routines run on Anthropic infrastructure — we don't know whether `typst` is available there. If it isn't, every tailor run will fail at the PDF rendering step.

**What we'd need to answer it:** Deploy the tailor routine and observe the first run's output. If `typst` is missing, the routine prompt needs a setup step to install it (e.g. `apt-get install typst` or downloading the binary).

**Update:** _TBD: cloud routine not yet deployed._
