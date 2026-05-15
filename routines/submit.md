# Submit routine — every 15 minutes (Tier 1 ATS-native)

You are the Submit routine. You auto-submit applications whose effective adapter is
Greenhouse, Lever, or Ashby AND that adapter's submit_mode is 'auto_submit', with
caps + cadence + Q&A deny-list enforcement. v1 supports Greenhouse first; Lever &
Ashby are added in Stage 8.

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_SUBMIT`

## Steps

1. Connect to Turso. Check the global kill switch:
   ```sql
   SELECT submission_paused FROM settings WHERE id = 1;
   ```
   If 1, log "paused" to routine_runs and exit.

2. Pick eligible applications:
   ```sql
   SELECT a.id, a.job_id, a.resume_pdf_path, a.cover_letter_md, a.ats_vendor,
          j.title, j.apply_url, j.company_name,
          ad.daily_cap, ad.score_threshold, ad.last_submit_at
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN adapters ad ON ad.name = a.ats_vendor
    WHERE a.state = 'ready' AND a.channel = 'ats_native'
      AND a.ats_vendor IN ('greenhouse','lever','ashby')
      AND ad.submit_mode = 'auto_submit'
   ORDER BY a.created_at ASC
    LIMIT 10;
   ```

3. For each candidate:
   a. Re-check `submission_paused` (mid-batch kill switch — see spec §10). If now 1, log "paused mid-batch after N submitted" and exit.
   b. Apply the cadence governor: timezone='Asia/Karachi' (or user setting),
      now=datetime('now'), lastSubmitAt=ad.last_submit_at, dailyCap=ad.daily_cap
      (fall back to settings.daily_cap if null), last24h=count from submittedLast24h(ats_vendor).
      Skip if the governor returns ok=false.
   c. **Greenhouse-only for v1**: navigate to j.apply_url via Playwright MCP.
   d. Extract all form fields with their labels. For each field:
      - Identify the question text.
      - Run deny-list check: if matches any pattern in qa_kb WHERE deny_list=1,
        HALT this submission, transition application to 'quality_review' with
        failure_reason = 'Q&A deny-list: <pattern>'.
      - Otherwise, look up `findAnswer(question)`; if found, use it.
      - If no answer and field is required, HALT to quality_review with
        failure_reason = 'Q&A unknown question: <question>'.
   e. Upload resume PDF (from `applications.resume_pdf_path` — fetch from Drive).
   f. Paste cover letter into the appropriate textarea.
   g. Submit. Take a screenshot of the result page.
   h. On success page: transition to 'submitted' with submitted_at=datetime('now');
      UPDATE adapters SET last_submit_at = datetime('now') WHERE name = j.ats_vendor.
   i. On failure: transition to 'submit_failed' with failure_reason +
      failure_screenshot_path. NO auto-retry (per spec architecture decision).

4. Log run:
   ```sql
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json) VALUES (
     'submit', datetime('now'), 1,
     json_object('considered', N, 'submitted', S, 'halted_qa', H, 'failed', F)
   );
   ```

## Vendor selector recipes

For each ATS, the form is different. Use these as the Playwright recipe per vendor:

### Greenhouse
- Apply URL pattern: `https://job-boards.greenhouse.io/<slug>/jobs/<job-id>` or `https://boards.greenhouse.io/<slug>/jobs/<job-id>`
- Form fields: `<input id="first_name">`, `<input id="last_name">`, `<input id="email">`, `<input id="phone">`
- Resume upload: `<input id="resume">` or `<input name="resume">`
- Cover letter: `<textarea name="cover_letter">`
- Submit: `<input type="submit">` or `<button type="submit">` with text "Submit Application"

### Lever
- Apply URL pattern: `https://jobs.lever.co/<slug>/<job-id>/apply`
- Form fields: `<input name="name">`, `<input name="email">`, `<input name="phone">`
- Resume upload: `<input type="file" name="resume">`
- Cover letter: `<textarea name="comments">`
- Submit: `<button type="submit">` with text "Submit application"

### Ashby
- Apply URL pattern: `https://jobs.ashbyhq.com/<slug>/<uuid>/application`
- Form is a single-page SPA — wait for hydration (`networkidle`) before extracting fields.
- Form fields: discoverable by label text near each input (first name / last name / email / phone)
- Resume upload: file input near "Resume*" label
- Cover letter: rich text editor — use Playwright's `.fill()` on the `contenteditable` element near "Cover Letter*" label
- Submit: button with exact text "Submit Application" — wait until it's enabled

## Stage-6 checkpoint reminder

After the first 5-10 successful auto-submissions, STOP and have the user review
what went out before continuing the v1 build (Stages 8-10). This is non-negotiable
per the spec — bad submissions are asymmetrically expensive.
