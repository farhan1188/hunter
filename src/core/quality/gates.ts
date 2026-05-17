import type { QualityGates } from "@/src/core/applications/types";
import { checkNumericsForAll } from "./numerics";
import { judgeAllPairs } from "./claim-equivalence";

export interface GatesInput {
  tailored_bullets: Array<{ tailored: string; original: string; source_numbers: string[] }>;
  cover_letter: string;
  verbatim_phrase: string | null;
  // Digits appearing in these (company name + role title) are treated as
  // factual context, not fabricated claims, so the numerics gate accepts them.
  company_name?: string;
  role_title?: string;
}

export async function runQualityGates(input: GatesInput): Promise<QualityGates> {
  const result: QualityGates = {
    numerics: null,
    claim_equiv: null,
    verbatim_phrase: null,
  };
  const noteParts: string[] = [];

  // Numerics
  const extraContext = [input.company_name ?? "", input.role_title ?? ""].join(" ");
  const num = checkNumericsForAll(
    input.tailored_bullets.map((b) => ({ tailored: b.tailored, source_numbers: b.source_numbers })),
    extraContext
  );
  result.numerics = num.pass ? "pass" : "fail";
  if (!num.pass) noteParts.push(`numerics: ${num.reason}`);

  // Claim equivalence
  const ce = await judgeAllPairs(
    input.tailored_bullets.map((b) => ({ original: b.original, tailored: b.tailored }))
  );
  result.claim_equiv = ce.pass ? "pass" : "fail";
  if (!ce.pass && ce.failure?.divergence_note) {
    noteParts.push(`claim_equiv: ${ce.failure.divergence_note}`);
  }

  // Verbatim phrase. If a phrase WAS fetched, enforce its presence (hard fail
  // on mismatch — a fabricated phrase is worse than no phrase). If no artifact
  // was fetchable, soft-pass with a note so the app can still proceed; the
  // cover letter just won't include a verbatim reference.
  if (input.verbatim_phrase) {
    result.verbatim_phrase = input.cover_letter.includes(input.verbatim_phrase) ? "pass" : "fail";
    if (result.verbatim_phrase === "fail") {
      noteParts.push(`verbatim_phrase: missing "${input.verbatim_phrase}"`);
    }
  } else {
    result.verbatim_phrase = "pass";
    noteParts.push(`verbatim_phrase: skipped (no company artifact)`);
  }

  if (noteParts.length > 0) result.notes = noteParts.join(" | ");
  return result;
}

export function allGatesPass(gates: QualityGates): boolean {
  return gates.numerics === "pass" && gates.claim_equiv === "pass" && gates.verbatim_phrase === "pass";
}
