# Tailoring

The Tailor routine takes applications in state `qualified` and produces a tailored resume PDF + cover letter, then runs quality gates to decide whether to advance to `ready` or route to `quality_review`. All code lives in `src/core/tailor/`.

**Cloud routine:** `routines/tailor.md` — every 30 minutes (`*/30 * * * *`).  
**Local-runner:** `scripts/run-tailor.ts` — `npm run tailor`.

---

## Pipeline order per application

```
qualified
  │
  ▼
1. selectBullets        — keyword overlap rank, top 8, no LLM
  │
  ▼
2. renderResumePdf      — Typst compile → PDF bytes
  │
  ▼
3. fetchAndSelectVerbatimPhrase — WebFetch + HTML strip + Haiku selection
  │
  ▼
4. generateCoverLetter  — Haiku, enforces verbatim phrase
  │
  ▼
5. runQualityGates      — numerics + claim-equiv + verbatim-phrase presence
  │
  ├─ all pass → state = 'ready'
  └─ any fail → state = 'quality_review'
```

---

## Bullet selection

`src/core/tailor/bullet-selection.ts` — **deterministic, no LLM**.

- Tokenises the JD into a set of lowercase ≥3-char tokens, excluding stopwords.
- For each bullet in `profile.resume_struct_json` (experience + projects), counts how many of its tokens appear in the JD token set.
- Sorts descending by overlap count, takes top `maxN` (routine passes 8).
- Returns `RankedBullet[]` with `source_company`, `source_title`, `score` attached.

The downstream claim-equivalence gate relies on the original bullet text being available for comparison, so `RankedBullet` carries it through to `runQualityGates`.

---

## Typst renderer

`src/core/tailor/typst-render.ts` — `renderResumePdf(input): Promise<Buffer>`.

- Builds a data JSON from `basics`, `selected_bullets` grouped back into experiences, `skills`, `education`.
- Creates a temp dir, writes `data.json` + `main.typ` (template file inline + `#resume(...)` call).
- Template lives at `src/core/tailor/templates/resume.typ`.
- Shells to the `typst` CLI: `spawn(process.env.TYPST_BIN || "typst", ["compile", mainPath, outPath])`.
- Reads the output PDF into a `Buffer` and cleans up the temp dir.
- **Requires `typst` on PATH, or `TYPST_BIN` env var pointing at the binary.** Install: `winget install Typst.Typst` (Windows) or `apt install typst` (Linux). On Windows winget often does not add a PATH shim — set `TYPST_BIN` in `.env` to the absolute exe path (see [gotchas](../gotchas.md)).

The cloud routine uploads the PDF bytes to Google Drive and writes the Drive file ID back to `applications.resume_pdf_path`. The local-runner script writes the PDF to a local path.

---

## Verbatim-phrase fetch

`src/core/tailor/verbatim-phrase.ts` — `fetchAndSelectVerbatimPhrase(applyUrl): Promise<VerbatimResult | null>`.

1. `fetch(applyUrl)` server-side (User-Agent: `job-hunter/1.0`).
2. `extractTextFromHtml(html)` — strips `<script>`, `<style>`, all tags; decodes HTML entities; collapses whitespace.
3. Calls Haiku with a system prompt instructing it to pick a **5–12-word exact substring** that captures the company's voice and would not plausibly be AI-generated.
4. Returns `{phrase, source_url, source_excerpt}` or `null` on fetch/parse failure.

If `null` is returned, the verbatim-phrase quality gate auto-fails and the application routes to `quality_review` with the note `verbatim_phrase: no company artifact`. The user can accept the generic cover letter from the review tray.

---

## Cover letter generator

`src/core/tailor/cover-letter.ts` — `generateCoverLetter(input): Promise<string>`.

Input fields: `profile_name`, `role_title`, `company_name`, `jd_summary`, `verbatim_phrase`, `max_words`.

The system prompt instructs Haiku to:
- Keep under `max_words` (default 250, configurable via `settings.cover_letter_max_words`).
- Include `verbatim_phrase` as an **exact substring** (≥5 words).
- Mention one or two concrete points of fit; no embellishment.
- Sign with the candidate's name.

Output is the cover letter markdown, stored in `applications.cover_letter_md`.

---

## v1 simplification: bullets are not rewritten

In v1, bullet selection returns the **original** bullet text unchanged — the tailored bullet equals the source bullet. No rewriting happens yet. This means:

- The numerics check always passes (source numbers trivially match themselves).
- The claim-equivalence judge trivially passes (tailored == original → fully equivalent).

Real per-JD bullet rewriting is a planned follow-up. The quality gate infrastructure is in place and will catch drift when rewriting is added.

---

## Routine behaviour

The routine (`routines/tailor.md`) picks up to **N=5** applications per run where `state = 'qualified' AND tailor_retries < 3`, ordered by `created_at ASC`.

For each application:
- Marks `state = 'tailoring'` before starting.
- Sets `channel` on completion:
  - `'ats_native'` if `j.ats_vendor IN ('greenhouse','lever','ashby')` AND that adapter's `submit_mode != 'off'`.
  - `'local_agent'` otherwise.
- On exception: bumps `tailor_retries`. At 3 retries routes to `quality_review` with note "tailor errored 3x".
- Logs `{processed, ready, quality_review, errored}` to `routine_runs`.

---

## Cost note

The cloud routine runs on Anthropic infrastructure under the Max subscription — Haiku calls are covered. The local-runner script (`npm run tailor`) uses the API key and costs approximately **$0.015 per application** (verbatim-phrase fetch + claim-equivalence calls). See also [decisions](../decisions.md) ADR-005.
