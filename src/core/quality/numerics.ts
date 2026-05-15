export interface NumericsResult {
  pass: boolean;
  reason?: string;
}

const DIGIT_RUN = /\d[\d,.\-]*/g;

/**
 * Every digit-run in `bullet` must appear (substring-match) in the source
 * `numbers` allow-list. Trailing punctuation is normalized away.
 */
export function checkNumerics(bullet: string, allowed: string[]): NumericsResult {
  const allowedSet = new Set(allowed.map((a) => a.trim()));
  const found = bullet.match(DIGIT_RUN) ?? [];
  for (const m of found) {
    const normalized = m.replace(/[,.\-]+$/, "");
    if (!allowedSet.has(normalized)) {
      return { pass: false, reason: `Bullet contains digit run "${m}" not in source numbers[]` };
    }
  }
  return { pass: true };
}

export function checkNumericsForAll(
  pairs: Array<{ tailored: string; source_numbers: string[] }>
): NumericsResult {
  for (const p of pairs) {
    const r = checkNumerics(p.tailored, p.source_numbers);
    if (!r.pass) return r;
  }
  return { pass: true };
}
