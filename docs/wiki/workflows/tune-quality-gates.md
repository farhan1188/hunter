# Tune quality gates

Adjusting gate prompts and logic after spot-checking submissions. Run when the
Needs review tray is too full (gates too strict) or when bad content is reaching
Ready (gates too loose).

Related: [components/quality-gates](../components/quality-gates.md) | [local-test-cycle](local-test-cycle.md) | [data-model](../data-model.md)

---

## When to tune

- **Tray consistently full** (>50% of applications land in `quality_review`) — gates
  are probably too strict, or a false-positive pattern is recurrent.
- **Spot-check finds garbage in Ready** — a gate is too loose and passing content
  it shouldn't.
- **After a prompt change** in tailoring — re-verify that gates still catch real drift.

Always check both directions. Loosening gates without verifying they still catch real
issues is as dangerous as leaving them too tight.

---

## Gate 1 — Numerics (deterministic)

**File:** `src/core/quality/numerics.ts`

**Common false positive:** The user's resume contains date ranges like `2020–2024`
or `Q1 2023`. The regex `/\d[\d,.\-]*/g` extracts `2020`, `2024`, `2023`, etc. as
digit-runs. These are not in `source_numbers[]` (which contains metrics like `12`,
`30%`, `$1M`) — so the gate fails.

**Fix option A — pre-strip date-context digits:**

1. Open `src/core/quality/numerics.ts`. Before the digit-run extraction, add a
   pre-processing step that removes 4-digit year patterns and ISO date strings:
   ```typescript
   const stripped = bullet.replace(/\b(19|20)\d{2}\b/g, "YEAR");
   ```
   Then run the regex on `stripped`, not `bullet`.

**Fix option B — mark date-context digits as allowed:**

2. In the function that builds `source_numbers[]` from `ResumeBullet.numbers`, add
   a post-processing step that appends year values from any bullet that contains a
   date range pattern. This is more surgical but requires changes to the extraction
   step in `src/profile/extract.ts`.

3. After either fix, run tests: `npm test -- numerics`
   Confirm no regressions.

---

## Gate 2 — Claim equivalence (LLM judge)

**File:** `src/core/quality/claim-equivalence.ts`

**Common false positive:** The judge flags synonym substitutions as divergence.
Examples: `"designed"` vs `"architected"`, `"led"` vs `"managed"`, `"built"` vs
`"implemented"`. The current SYSTEM prompt says `"soft drift counts as divergence"`,
which is intentionally strict.

**Fix — relax the synonym rule:**

4. Open `src/core/quality/claim-equivalence.ts`. Find the SYSTEM prompt (the
   template literal passed as `role: "system"` to Haiku). Locate the phrase
   `"soft drift counts as divergence"`.

5. Replace or supplement it with:
   ```
   Synonym substitution (e.g. "designed" for "architected", "led" for "managed")
   is NOT divergence. Only flag actual new claims: new technologies, new team sizes,
   new results, new time periods, or new ownership scope.
   ```

6. Test on a known false-positive pair. Reset a `quality_review` application to
   `qualified` via SQL, run `npm run tailor`, and verify the pair now passes.

**Do not loosen below:** New technologies, inflated numbers, and scope expansions
must still fail. Test that a bullet claiming "led 50 engineers" against a source
bullet with "led 12 engineers" still fails after your change.

---

## Gate 3 — Verbatim phrase (substring check)

**File:** `src/core/tailor/verbatim-phrase.ts` (phrase selection)
**Gate check:** `src/core/quality/gates.ts:35` (the `includes()` call — do not change)

**Common failure mode:** `fetchAndSelectVerbatimPhrase(applyUrl)` returns `null`
because the company's apply page is a JS-rendered SPA. The fetch gets an empty body
or a loading spinner's HTML. The gate auto-fails with `verbatim_phrase: no company artifact`.

**Fix — try fallback URLs:**

7. Open `src/core/tailor/verbatim-phrase.ts`. Find the `fetchAndSelectVerbatimPhrase`
   function. After the initial fetch attempt, add a fallback chain:
   ```typescript
   // Fallback 1: try the company homepage derived from apply URL
   const companyRoot = new URL(applyUrl).origin;
   // Fallback 2: try /about
   const aboutUrl = `${companyRoot}/about`;
   ```
   If the first fetch returns fewer than 200 characters of text, try the fallback URLs.

8. Alternatively, if the job's `description_md` is long enough, fall back to extracting
   the verbatim phrase from the JD itself rather than the company page. This is less
   personalised but always available.

9. After the fix, run: `npm run tailor` on a batch that previously showed `null` phrase.
   Confirm phrases are now selected.

---

## Process for any gate change

10. Change the prompt or logic.

11. Reset a small batch of applications to `qualified` via the Turso web console SQL tab:
    ```sql
    UPDATE applications SET state = 'qualified', tailor_retries = 0
    WHERE state = 'quality_review'
    LIMIT 5;
    ```

12. Run: `npm run tailor`

13. Open `/pipeline`. Count cards in Ready vs Needs review for this batch.
    A healthy ratio is ≥70% landing in Ready without manual intervention.

14. Click into 2 Ready cards and 1 Needs review card. Read the quality gates tab.
    Confirm Ready cards genuinely pass all three gates and the Needs review card has
    a legitimate failure.

15. If the ratio is still wrong, iterate from step 10. Do not deploy prompt changes
    to the cloud routines until you're satisfied with the local results.

16. Update the cloud routines by editing the relevant `routines/tailor.md` section
    that references the gate logic, then re-deploy via `/schedule`.

17. Run the full test suite after any code change: `npm test`
    All tests must pass.
