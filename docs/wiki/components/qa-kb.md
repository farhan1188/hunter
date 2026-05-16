# Q&A Knowledge Base

The Q&A KB prevents the system from auto-answering sensitive form questions (visa status, salary, EEO disclosures) while allowing it to reuse safe answers across applications. All code lives in `src/core/qa/`. See [data-model](../data-model.md) for the schema and [decisions](../decisions.md) ADR-004 for the rationale.

---

## Table structure

`qa_kb` schema:

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pattern` | TEXT UNIQUE | Substring to match against form question labels |
| `answer` | TEXT | Stored answer (empty string for deny-list entries) |
| `user_verified` | INTEGER | `1` = user has approved this answer |
| `deny_list` | INTEGER | `1` = always halt, never answer |
| `last_used` | TEXT | ISO timestamp of last use by a submitter |

---

## Deny-list patterns (seeded by migration 005)

20 patterns are seeded at install time with `deny_list = 1`, `user_verified = 0`, `answer = ''`:

```
work_auth           work_authorization      authorized_to_work
sponsor             sponsorship             visa
citizen             citizenship             eeo
race                gender                  ethnicity
disability          veteran                 salary_expectation
expected_salary     desired_salary          compensation
notice_period       start_date
```

These cover immigration status, EEO disclosures, salary negotiation, and start-date questions. Wrong answers to any of these carry legal, financial, or immigration consequences that outweigh any submission efficiency gain.

---

## Deny-list matcher

`src/core/qa/deny-list.ts` — `matchesDenyList(text, patterns): string | null`.

- Case-insensitive substring search.
- Returns the first matched pattern or `null`.
- Used by both the Tier 1 Submit routine and the Local Agent before any field is filled.

```ts
matchesDenyList("Are you authorized to work in the US?", patterns)
// → "authorized_to_work"
```

---

## KB query functions

`src/core/qa/kb.ts`:

| Function | Signature | Notes |
|---|---|---|
| `listKb(db)` | `→ QaEntry[]` | Returns all rows, ordered by pattern |
| `upsertAnswer(db, pattern, answer)` | `→ void` | Inserts or updates; always sets `user_verified = 1, deny_list = 0` |
| `findAnswer(db, question)` | `→ string \| null` | Substring-matches question against all `user_verified = 1, deny_list = 0` patterns; returns stored answer or null |

`findAnswer` is used at submission time to auto-fill safe known questions (e.g. "Years of experience with React?" if the user has answered that before).

---

## API

`app/api/qa-kb/route.ts`:

- `GET /api/qa-kb` — calls `listKb`, returns all entries. Used by the `/pipeline/[id]` Q&A tab and the settings UI.
- `POST /api/qa-kb` — calls `upsertAnswer(pattern, answer)`. Only accepts non-deny-list upserts (the route validates that deny-list patterns cannot be answered via API).

---

## User workflow

1. Submit routine or Local Agent encounters a form question.
2. `matchesDenyList` is called first. Any deny-list match → submission halts, application moves to `quality_review` with `failure_reason = 'Q&A deny-list: <pattern>'`.
3. For non-deny-list questions: `findAnswer` is called. If a verified answer exists, it is used automatically.
4. If no answer exists and the field is required → submission halts, application moves to `quality_review` with `failure_reason = 'Q&A unknown question: <question>'`.
5. User sees the flagged question in the Needs Review column. Opens the application detail → Q&A tab.
6. User types an answer and submits via the Q&A admin UI (minimal in v1 — a single text input per pattern).
7. `upsertAnswer` stores the answer with `user_verified = 1`.
8. Next time a form has the same pattern, the answer is used automatically.

Deny-list entries are **never** re-qualified by user answer. The only action on a deny-list halt is: user reviews the form manually, fills the question by hand in the Local Agent, then marks the application submitted.
