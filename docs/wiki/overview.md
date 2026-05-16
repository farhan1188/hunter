# Project overview

## What this is

A personal autonomous job-hunting platform. The user uploads their resume once. The platform then continuously:

1. **Discovers** jobs from LinkedIn (via Apify, no account risk) + 9 other job sources + manual paste-URL.
2. **Filters** each job by archetype (does the title fit the candidate's target roles?) + visa category (does the candidate's work auth match?) + LLM-based scoring against the candidate profile.
3. **Tailors** a per-job resume PDF and cover letter for every qualified job, with three quality gates to prevent hallucinations.
4. **Submits** automatically to Greenhouse / Lever / Ashby. For other sites (LinkedIn Easy Apply, Workday, custom company careers pages), prepares the application for one-click send via a Local Agent that uses the user's authenticated Chrome.
5. **Tracks** everything through an application state machine, surfaced in a Hub UI with a dashboard, pipeline view, and per-application detail.

## Who the user is

- **Senior dev based in Pakistan** (UTC+5 / Asia/Karachi).
- Currently US-remote earning ~$3K/mo USD; targeting higher-paying global remote OR sponsorship in US / UK / EU / Canada / Australia / UAE / Singapore.
- Email: farhan1188@gmail.com.
- Has a Claude Code Max subscription — architecture preference is to keep LLM work in routines (covered by Max) rather than direct API calls where feasible.
- Time-constrained (day job) and cost-sensitive (every dollar of LLM spend matters at $3K/mo income).
- **This is not engineering practice.** The user genuinely needs to apply to jobs. Quality > quantity. Outcomes > architecture.

## Why this exists

The bottleneck in modern job hunting isn't discovery — LinkedIn, RemoteOK, Wellfound already give you more jobs than you can act on. The bottleneck is **tailoring time**: ~20 minutes per job to read the JD, customize the resume, write a cover letter, fill the form. Most candidates skip tailoring and send generic applications, which is why response rates are terrible.

This platform reduces tailoring time from ~20 minutes to ~30 seconds of human review per application, while keeping a human in the loop for the actually-irreversible click on most sites.

## Design philosophy

Distilled from the original spec + feedback memories:

- **Application-first, not job-first.** A job is just input; the atomic unit is an in-flight application.
- **Two-tier submission, not full automation.** ATS-native (Greenhouse/Lever/Ashby) is safe to auto-submit at low volume. Everything else needs a human click. We don't pretend otherwise.
- **Draft-only outreach forever.** Auto-sent LinkedIn DMs are the fastest way to a permanent account ban. We draft; the user sends.
- **Three quality gates** on every tailored artifact: per-bullet numerics (no hallucinated numbers), claim-equivalence (no scope drift), verbatim phrase (cover letter contains a substring from the company's own materials, so it isn't generic).
- **Asymmetric cost of bad submissions.** One blacklisting recruiter is worth more than 100 successful submissions. Hence: quality gates, deny-list for sensitive Q&A, mid-batch pause checks, per-source caps, Poisson cadence in target timezone.
- **Trim ceremony where it doesn't serve the goal.** No ORMs. No embedded replicas for one user. No test pyramid where smoke tests suffice. No source-health dashboards until they're earned. The trade-offs explicitly favor "ship something that gets the user a high-paying job" over architecture porn.

## What the platform is NOT

- Not a job board — discovery is a pipe, not a destination.
- Not a CRM (yet) — basic state tracking only. Hunt-outcome analytics (responses/interviews/offers) deferred until ≥50 submissions exist.
- Not multi-tenant — single user, single profile, single .env.
- Not a SaaS — runs on the user's machine + their Anthropic Max + their Turso account.

## The three-phase history

1. **Phase 1 (Radar)** — built 2026-05-13. Just discovery + scoring. Shipped, used, found "too heavy." Trigger for the v1 pivot.
2. **v1 application-pipeline** — built 2026-05-14 to 2026-05-16 (this session). Collapsed former Phase 2 (Tailoring) and Phase 3 (Auto-submit) into one product where the atomic unit is an in-flight application. Code-complete as of 2026-05-16; not yet deployed end-to-end.
3. **v2 and beyond** — not designed. Likely candidates if v1 ships well: hunt-outcome tracking, per-archetype dials, broader ATS coverage (Workday Web Apply, Greenhouse-via-LinkedIn redirect handling), maybe an "interview prep" module.

## Cost profile

Once running steady-state at projected volume (1,500-3,000 LinkedIn jobs/month + existing-adapter crawls):

- **Apify** — $0-$1/month (free $5 credit covers it).
- **Anthropic** — covered by Max for routine LLM work. Direct API usage in Hub: ~$2/month for resume extraction (one-shot per upload), JD extraction in paste-URL flow, outreach drafts.
- **Turso** — free tier (billions of row reads, well under).
- **Drive** — free tier.
- **GitHub** — free.

**Total operating cost: $0-3/month.**

## Key constraints to remember

- User is **Pakistan-based** → target timezone is `Asia/Karachi`. Submission cadence governor restricts auto-submits to 09:00-22:00 local. Don't accidentally schedule routines at the user's 3am.
- User pays for LLM tokens out of pocket when work happens via Hub API calls. Default to routines (Max-covered) where the workflow allows.
- LinkedIn account is precious. Architecture decision: **no in-browser LinkedIn scraping by the user's Chrome.** Discovery goes through Apify (third-party infrastructure, third-party accounts).
