import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import type { Profile, JobPosting } from "@/src/core/types";

export type ArchetypeLabel = "match" | "maybe" | "mismatch";

interface MinimalPosting {
  id: string;
  title: string;
}

const SYSTEM = `You classify whether a job title is in the same career archetype as the
candidate's target roles. Output ONLY a JSON object mapping each job id to one of:
"match", "maybe", "mismatch". No prose, no code fences.

Definitions:
- match: same archetype family (e.g. candidate wants PM, job is "Senior Product Manager")
- maybe: adjacent / unclear (e.g. candidate wants PM, job is "Developer Advocate" or "Product Engineer")
- mismatch: clearly wrong family (e.g. candidate wants PM, job is "Senior Backend Engineer" or "Designer")

Bias toward "match" or "maybe" when ambiguous. Reserve "mismatch" for clearly-wrong
archetypes (titles where no reasonable hiring manager would consider this candidate).`;

/**
 * Batch-classify a list of postings by archetype against the candidate's target roles.
 * Single Haiku call per batch (default 20 titles). Returns id → label.
 */
export async function classifyArchetypes(
  profile: Profile,
  postings: MinimalPosting[],
  batchSize = 20
): Promise<Map<string, ArchetypeLabel>> {
  const out = new Map<string, ArchetypeLabel>();
  const targetRoles =
    profile.preferences.target_roles?.join(", ") || "(none specified)";

  for (let i = 0; i < postings.length; i += batchSize) {
    const batch = postings.slice(i, i + batchSize);
    const userText = [
      `Candidate target roles: ${targetRoles}`,
      ``,
      `Classify each of these job titles. Return ONLY a JSON object: {"<id>": "match"|"maybe"|"mismatch", ...}`,
      ``,
      batch.map((p) => `${p.id}: ${p.title}`).join("\n"),
    ].join("\n");

    try {
      const res = await getAnthropic().messages.create({
        model: MODEL_HAIKU,
        max_tokens: 600,
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
      const parsed = JSON.parse(text) as Record<string, ArchetypeLabel>;
      for (const p of batch) {
        const label = parsed[p.id];
        if (label === "match" || label === "maybe" || label === "mismatch") {
          out.set(p.id, label);
        } else {
          out.set(p.id, "maybe"); // defensive — don't drop on parser glitch
        }
      }
    } catch (err) {
      console.error(`Archetype batch classify failed:`, err);
      for (const p of batch) out.set(p.id, "maybe");
    }
  }
  return out;
}

/** Narrow JobPosting → MinimalPosting for use with classifyArchetypes. */
export function toMinimal(p: JobPosting): MinimalPosting {
  return { id: p.id, title: p.title };
}
