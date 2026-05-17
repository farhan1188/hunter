export interface NumericsResult {
  pass: boolean;
  reason?: string;
}

const DIGIT_RUN = /\d[\d,.\-]*/g;

// Strip trailing/embedded suffix characters that are formatting, not part of
// the magnitude: + (e.g. "20+"), % ("99%"), K/M/B ("$5M"), $ ("$1,500"). After
// normalization "20+" → "20" and matches "20+" in source numbers[] cleanly.
function normalize(s: string): string {
  return s.replace(/[+%KkMmBbk$]/g, "").replace(/[,.\-]+$/, "").trim();
}

/**
 * Every digit-run in `bullet` must appear (normalized) in the source
 * `numbers` allow-list, OR in `extraContext` (company name + role title text —
 * digits appearing there are accepted since they're factual, not invented).
 */
export function checkNumerics(
  bullet: string,
  allowed: string[],
  extraContext: string = ""
): NumericsResult {
  const allowedSet = new Set(allowed.map(normalize).filter(Boolean));
  for (const m of extraContext.match(DIGIT_RUN) ?? []) {
    const n = normalize(m);
    if (n) allowedSet.add(n);
  }
  const found = bullet.match(DIGIT_RUN) ?? [];
  for (const m of found) {
    if (!allowedSet.has(normalize(m))) {
      return { pass: false, reason: `Bullet contains digit run "${m}" not in source numbers[]` };
    }
  }
  return { pass: true };
}

export function checkNumericsForAll(
  pairs: Array<{ tailored: string; source_numbers: string[] }>,
  extraContext: string = ""
): NumericsResult {
  for (const p of pairs) {
    const r = checkNumerics(p.tailored, p.source_numbers, extraContext);
    if (!r.pass) return r;
  }
  return { pass: true };
}
