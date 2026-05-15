import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";

export interface ClaimEquivResult {
  equivalent: boolean;
  divergence_note: string | null;
}

const SYSTEM = `You compare two resume bullets. The tailored bullet must not
introduce ANY claim (scope, technology, team size, ownership, time period,
results) that isn't present in the original. Output JSON only:
{"equivalent": boolean, "divergence_note": string|null}.
Be strict — soft drift counts as divergence.`;

export async function judgeClaimEquivalence(input: {
  original: string;
  tailored: string;
}): Promise<ClaimEquivResult> {
  const userText = `Original: ${input.original}\nTailored: ${input.tailored}`;
  const res = await getAnthropic().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });
  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  return JSON.parse(text) as ClaimEquivResult;
}

export async function judgeAllPairs(
  pairs: Array<{ original: string; tailored: string }>
): Promise<{ pass: boolean; failure?: ClaimEquivResult & { pair: (typeof pairs)[0] } }> {
  for (const p of pairs) {
    const r = await judgeClaimEquivalence(p);
    if (!r.equivalent) return { pass: false, failure: { ...r, pair: p } };
  }
  return { pass: true };
}
