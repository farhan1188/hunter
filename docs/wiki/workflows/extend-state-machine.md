# Extend the state machine

How to add a new application state or transition without breaking invariants. This
workflow touches five different files — all five must change together or the system
is in an inconsistent state.

Related: [data-model](../data-model.md) | [components/submission](../components/submission.md) | [conventions](../conventions.md)

---

## Read first

Before writing any code, read `docs/wiki/data-model.md` in full. Understand:
- The current state diagram and which states are terminal.
- The invariant that only one `applications` row can exist per `job_id`.
- How `channel` is set (only on the transition INTO `ready`).
- Why `submit_failed` has no auto-retry path.

If your new state is terminal (nothing transitions out of it), confirm that explicitly
before proceeding.

---

## Steps

### 1. Add the state to the TypeScript union

1. Open `src/core/applications/types.ts`. Find the `ApplicationState` union:
   ```typescript
   export type ApplicationState =
     | "qualified"
     | "tailoring"
     | "quality_review"
     | "ready"
     | "submitted"
     | "submit_failed"
     | "closed"
     | "dismissed";
   ```

2. Add your new state to the union. Keep alphabetical order within non-terminal states
   for readability. Terminal states (`submitted`, `closed`, `dismissed`) stay at the end.

3. TypeScript will now show type errors everywhere the `ApplicationState` union is
   exhaustively checked (switch statements with `never` fallthrough). These errors
   are your checklist — fix each one.

### 2. Add edges to the transitions map

4. Open `src/core/applications/transitions.ts`. Find the `EDGES` map:
   ```typescript
   export const EDGES: Record<ApplicationState, ApplicationState[]> = {
     qualified: ["tailoring", "dismissed", "closed"],
     tailoring: ["quality_review", "ready", "dismissed", "closed"],
     ...
   };
   ```

5. Add an entry for your new state listing all valid outbound transitions.
   If the state is terminal, its array is empty: `new_state: []`.

6. For any existing states that should be able to transition INTO your new state,
   add your new state to their arrays.

7. The `assertValidTransition(from, to)` function reads from `EDGES` at runtime and
   throws `"illegal transition: <from> → <to>"` for any edge not listed. It does not
   need to be updated — it already uses the `EDGES` map.

### 3. Update the tests

8. Open `tests/applications/transitions.test.ts`.

9. Add at least two test cases for your new state:
   - A **legal** transition: `assertValidTransition("<new_state>", "<valid_next>")` —
     should not throw.
   - An **illegal** transition: `expect(() => assertValidTransition("<new_state>", "qualified")).toThrow()` —
     should throw.

10. Add a test for any existing state whose outbound list you modified.

11. Run: `npm test -- transitions`
    All tests must pass.

### 4. Add a migration if the state stores new data

12. If your new state requires new columns on `applications` (e.g. a timestamp or
    a JSON blob specific to this state), create a new migration file:
    ```
    src/db/migrations/006_<descriptive>.sql
    ```
    Use `ALTER TABLE applications ADD COLUMN <col> TEXT;` (SQLite allows nullable
    additions without a default).

13. Apply the migration: `npm run db:migrate`
    Expected: `APPLY 006_<descriptive>.sql … Migrations complete.`

### 5. Update the Hub UI

14. Open `app/pipeline/page.tsx`. The pipeline Kanban renders a column per state group.
    Add your new state to the appropriate column definition. If it's a new column,
    add a `<Column>` component entry.

15. Open `app/pipeline/[id]/page.tsx`. The detail page renders state-specific action
    buttons (e.g. "Accept / move to Ready" appears only in `quality_review`). Add a
    condition for your new state if it needs UI actions.

16. Open the badge/status pill component (search for `state` props in `app/pipeline/`).
    Add a colour mapping for the new state so it doesn't render as a grey unknown pill.

### 6. Update any routines that produce or consume the state

17. If a cloud routine transitions applications INTO or OUT OF your new state, open
    the relevant file in `routines/` and update its SQL `WHERE state = '...'` clauses
    and any `UPDATE applications SET state = '...'` statements.

18. If the Local Agent consumes the new state (`agent/src/state.ts`), update the
    `pickNextReady` query or add a new query function.

### 7. Update the wiki

19. Open `docs/wiki/data-model.md`. Update the state diagram, the States table, and
    the Legal transitions table. Add any new invariants the new state introduces.

### 8. Final check

20. Run the full test suite: `npm test`
    All existing tests must pass.

21. Start the Hub and manually verify the new state appears correctly in `/pipeline`
    and `/pipeline/[id]`.

22. Commit all changed files together:
    ```
    git add src/core/applications/types.ts src/core/applications/transitions.ts tests/applications/transitions.test.ts app/pipeline/ docs/wiki/data-model.md
    git commit -m "feat(applications): add <new_state> state"
    ```
