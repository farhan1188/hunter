import type { ResumeStruct, ResumeBullet } from "@/src/core/types";

const STOPWORDS = new Set([
  "the","and","for","with","you","your","our","a","an","of","to","in","on","at",
  "we","i","is","are","be","by","or","as","it","this","that","from","will","have",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().match(/[a-z0-9+#\.\-]{3,}/g)?.filter((t) => !STOPWORDS.has(t)) ?? []
  );
}

export interface RankedBullet extends ResumeBullet {
  source_company: string;
  source_title: string;
  score: number;
}

/**
 * Rank resume bullets by lexical overlap with the JD. No LLM — this is a
 * deterministic pre-filter. The downstream Haiku claim-equivalence check
 * catches bullets that get distorted, so the ranking just needs "decent."
 */
export function selectBullets(resume: ResumeStruct, jd: string, maxN: number): RankedBullet[] {
  const jdTokens = tokenize(jd);
  const ranked: RankedBullet[] = [];
  for (const exp of resume.experience) {
    for (const b of exp.bullets) {
      const bt = tokenize(b.text);
      let score = 0;
      for (const t of bt) if (jdTokens.has(t)) score++;
      ranked.push({ ...b, source_company: exp.company, source_title: exp.title, score });
    }
  }
  for (const p of resume.projects) {
    for (const b of p.bullets) {
      const bt = tokenize(b.text);
      let score = 0;
      for (const t of bt) if (jdTokens.has(t)) score++;
      ranked.push({ ...b, source_company: p.name, source_title: "Project", score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, maxN);
}
