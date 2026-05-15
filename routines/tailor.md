# Tailor routine — every 30 minutes

You are the Tailor routine. You take applications in state `qualified`, produce
a tailored resume PDF + cover letter, run quality gates, and route to either
`ready` (gates pass) or `quality_review` (gates fail).

## Environment

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN_TAILOR` (scoped)
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_DRIVE_FOLDER_ID`

## Steps

1. Connect to Turso. Pick up to N=5 applications:
   ```sql
   SELECT a.id, a.job_id, a.tailor_retries,
          j.title, j.company_name, j.description_md, j.apply_url,
          p.resume_struct_json, p.basics_json,
          s.cover_letter_max_words
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN profile p ON p.id = 1
     JOIN settings s ON s.id = 1
    WHERE a.state = 'qualified' AND a.tailor_retries < 3
    ORDER BY a.created_at ASC
    LIMIT 5;
   ```

2. For each application:
   a. Mark `state = 'tailoring'` (UPDATE).
   b. Select top 8 bullets ranked by JD-keyword overlap (selectBullets equivalent).
   c. Render the tailored resume PDF via Typst (template + JSON input).
   d. Upload PDF to Drive → get file id. Store as `resume_pdf_path`.
   e. Fetch the company artifact URL (job's apply_url or company root) → extract
      visible text → ask Haiku for a 5-12-word distinctive phrase (verbatim phrase).
   f. Ask Haiku to write the cover letter, including the verbatim phrase verbatim.
   g. Run quality gates:
      - Numerics check (deterministic; bullet digits in source numbers[])
      - Claim-equivalence (Haiku per bullet pair)
      - Verbatim phrase present as exact substring of cover letter
   h. If all gates pass → `state = 'ready'`, set `channel`:
      - 'ats_native' if `j.ats_vendor IN ('greenhouse','lever','ashby')` AND that
        adapter's submit_mode != 'off'
      - 'local_agent' otherwise
      Set `resume_pdf_path`, `cover_letter_md`, `quality_gates_json`.
   i. If any gate fails → `state = 'quality_review'`, set
      `quality_gates_json` with the per-gate pass/fail + notes.
   j. On exception → bump `tailor_retries`. If it hits 3, route to
      `quality_review` with note "tailor errored 3x".

3. Log run to `routine_runs`:
   ```sql
   INSERT INTO routine_runs (routine, finished_at, ok, stats_json) VALUES (
     'tailor', datetime('now'), 1,
     json_object('processed', N, 'ready', R, 'quality_review', Q, 'errored', E)
   );
   ```

## Cost note

This routine runs on Anthropic infrastructure under the user's Max
subscription. Haiku calls are free at this volume. Drive uploads are also free.

## Failure modes

- Drive write fails: leave application in `tailoring`, bump retry count.
- Typst missing on host: fatal — surface in routine_runs.error so the user
  installs it.
- Haiku JSON parse failure: treat as gate failure with note "judge parse error";
  human reviews.
