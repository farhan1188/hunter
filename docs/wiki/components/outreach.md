# Outreach

Outreach generates a short LinkedIn DM draft for a specific application. It never sends — draft and copy only. All code lives in `src/core/outreach/draft.ts`. See [decisions](../decisions.md) ADR-003 for the permanent ban on auto-send.

---

## Core function

`draftMessage(input: DraftInput): Promise<string>` — `src/core/outreach/draft.ts:17`.

Input:
```ts
interface DraftInput {
  target_name: string;      // "Hiring Manager" or a specific name if known
  role_title: string;
  company_name: string;
  jd_summary: string;       // first 600 chars of description_md
  candidate_summary: string;
}
```

Model: **Haiku**. System prompt:

> Write short, conversational LinkedIn DMs (75-100 words). Lead with a specific reason you're interested in the role / company. Mention one concrete relevant fit. Close with a soft ask to chat. NO hashtags. NO emojis. Output the DM text only.

Returns the DM string. No DB writes.

---

## Convenience wrapper

`draftOutreach(db, applicationId): Promise<string>` — `src/core/outreach/draft.ts:38`.

1. Joins `applications → jobs → profile` to pull `title`, `company_name`, `description_md`, `basics_json`.
2. Uses `"Hiring Manager"` as `target_name` (v1 default — no recruiter scraping).
3. Uses a hardcoded `candidate_summary` (`"Senior product/engineering experience"`) — crude placeholder; marked as a follow-up improvement in the source at line 49.
4. Calls `draftMessage`.
5. INSERTs a row into `outreach_drafts` with `application_id`, `target_name = 'Hiring Manager'`, `message_md`.
6. Returns the draft string to the caller.

---

## Hub UI

The outreach flow is surfaced on the application detail page at `/pipeline/[id]`:

1. User opens the **Outreach** tab (6th tab on the detail page).
2. Clicks **"Draft LinkedIn DM"** button.
3. `POST /api/applications/[id]/outreach` — calls `draftOutreach(db, id)`.
4. The draft text appears in the tab with a **Copy** button.
5. Clicking Copy sets `outreach_drafts.copied_at = now()`.

The draft is never sent programmatically. The user pastes it into LinkedIn manually.

---

## What is NOT applied

The verbatim-phrase pattern from cover letters (a ≥5-word exact substring from the company's own materials) is **not applied** to outreach drafts in v1. Rationale: a LinkedIn DM is short (75-100 words), conversational, and unsigned by the same professional conventions as a cover letter. Inserting a verbatim phrase into a DM would often read as awkward or off-brand. Documented as a future consideration if personalisation quality proves insufficient.

---

## `outreach_drafts` table

| Column | Notes |
|---|---|
| `id` | Auto-increment integer PK |
| `application_id` | FK → `applications.id` (CASCADE DELETE) |
| `target_name` | Name used in the draft |
| `target_linkedin_url` | Not populated in v1 |
| `target_role` | Not populated in v1 |
| `message_md` | The generated DM text |
| `copied_at` | Timestamp when user clicked Copy; null until then |
| `created_at` | Row creation timestamp |

See [data-model](../data-model.md) for the full schema.
