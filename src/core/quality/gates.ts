import type { QualityGates } from "@/src/core/applications/types";
import { checkNumericsForAll } from "./numerics";
import { judgeAllPairs } from "./claim-equivalence";

export interface GatesInput {
  tailored_bullets: Array<{ tailored: string; original: string; source_numbers: string[] }>;
  cover_letter: string;
  verbatim_phrase: string | null;
}

export async function runQualityGates(input: GatesInput): Promise<QualityGates> {
  const result: QualityGates = {
    numerics: null,
    claim_equiv: null,
    verbatim_phrase: null,
  };

  // Numerics
  const num = checkNumericsForAll(
    input.tailored_bullets.map((b) => ({ tailored: b.tailored, source_numbers: b.source_numbers }))
  );
  result.numerics = num.pass ? "pass" : "fail";
  if (!num.pass) result.notes = `numerics: ${num.reason}`;

  // Claim equivalence
  const ce = await judgeAllPairs(
    input.tailored_bullets.map((b) => ({ original: b.original, tailored: b.tailored }))
  );
  result.claim_equiv = ce.pass ? "pass" : "fail";
  if (!ce.pass && ce.failure?.divergence_note) {
    result.notes = (result.notes ?? "") + ` | claim_equiv: ${ce.failure.divergence_note}`;
  }

  // Verbatim phrase
  if (input.verbatim_phrase) {
    result.verbatim_phrase = input.cover_letter.includes(input.verbatim_phrase) ? "pass" : "fail";
    if (result.verbatim_phrase === "fail") {
      result.notes = (result.notes ?? "") + ` | verbatim_phrase: missing "${input.verbatim_phrase}"`;
    }
  } else {
    result.verbatim_phrase = "fail";
    result.notes = (result.notes ?? "") + ` | verbatim_phrase: no company artifact`;
  }

  return result;
}

export function allGatesPass(gates: QualityGates): boolean {
  return gates.numerics === "pass" && gates.claim_equiv === "pass" && gates.verbatim_phrase === "pass";
}
