/**
 * Returns the matched pattern (first match wins) or null. Substring match,
 * case-insensitive.
 */
export function matchesDenyList(text: string, patterns: string[]): string | null {
  const lower = text.toLowerCase();
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) return p;
  }
  return null;
}
