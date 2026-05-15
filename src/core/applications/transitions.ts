import type { ApplicationState } from "./types";

/**
 * Edges of the application state machine. See §4 of the spec.
 * - `closed` and `dismissed` are reachable from any non-terminal state (handled below).
 * - `submitted` and `submit_failed` are terminal except for one explicit re-queue path
 *   (submit_failed → ready) the user triggers from the UI.
 */
const EDGES: Record<ApplicationState, ApplicationState[]> = {
  qualified:      ["tailoring", "dismissed", "closed"],
  tailoring:      ["quality_review", "ready", "dismissed", "closed"],
  quality_review: ["ready", "dismissed", "closed"],
  ready:          ["submitted", "submit_failed", "dismissed", "closed"],
  submitted:      [],                          // terminal
  submit_failed:  ["ready", "dismissed"],     // user can re-queue
  closed:         [],                          // terminal
  dismissed:      [],                          // terminal
};

export function isValidTransition(
  from: ApplicationState,
  to: ApplicationState
): boolean {
  return EDGES[from]?.includes(to) ?? false;
}

export function assertValidTransition(
  from: ApplicationState,
  to: ApplicationState
): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`illegal transition: ${from} → ${to}`);
  }
}
