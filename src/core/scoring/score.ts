import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import type {
  JobPosting,
  Profile,
  JobScore,
  ResumeStruct,
} from "@/src/core/types";

const SYSTEM = `You score a job posting against a candidate's profile from 0–100.

# Archetype-first scoring

Before scoring, identify two things:
1. **Candidate archetype** — from the candidate's most recent title + bullet content:
   examples: "product manager", "solutions engineer", "backend engineer", "frontend engineer",
   "ml engineer", "data scientist", "designer", "data engineer", "devops/sre", "tpm",
   "developer advocate", "technical writer".
2. **Job archetype** — from the JD's title + description:
   same vocabulary.

**Archetype match is the dominant signal.** Skills overlap does NOT compensate for an
archetype mismatch. A Product Manager applying to a Backend Engineer role is wrong-archetype
regardless of how much shared vocabulary appears in the JD.

# Dimensions (each 0–100)

- **role_fit (weight 45%)** — archetype alignment + target-roles alignment:
  - same archetype AND title matches one of preferences.target_roles → 90–100
  - same archetype, related but not exact title → 70–85
  - adjacent archetype (e.g. PM ↔ Solutions Engineer, ML Engineer ↔ Data Scientist) → 45–65
  - wrong archetype (e.g. PM applying to SWE, Designer applying to TPM) → **0–25, hard cap**
- **skill_fit (weight 25%)** — JD's required skills/tools vs candidate's primary+secondary
- **level_fit (weight 20%)** — intern << junior << mid << senior << staff << principal
- **location_fit (weight 7%)** — remote/timezone/country vs preferences
- **comp_fit (weight 3%, only if JD lists salary)** — meets candidate's min

Overall = weighted average. **If role_fit < 25, overall MUST be < 35.**

# Output

Return JSON ONLY (no code fences, no prose):
{
  "value": <int 0-100>,
  "reasoning": "<1-2 sentences: name the archetypes, then the verdict>",
  "dimensions": {
    "role_fit": <int>,
    "skill_fit": <int>,
    "level_fit": <int>,
    "location_fit": <int>,
    "comp_fit": <int|null>
  }
}`;

function compactResume(s: ResumeStruct | undefined): string {
  if (!s) return "(no structured resume yet)";
  const lines: string[] = [];
  // Most recent role first — include 3 bullets so the LLM can see what the candidate actually does
  for (const e of s.experience.slice(0, 3)) {
    lines.push(`- ${e.title} @ ${e.company} (${e.start}–${e.end ?? "now"})`);
    for (const b of e.bullets.slice(0, 3)) {
      lines.push(`    • ${b.text}`);
    }
  }
  const skills = [
    ...s.skills.primary.slice(0, 12),
    ...s.skills.secondary.slice(0, 8),
  ].join(", ");
  return `Recent experience:\n${lines.join("\n")}\n\nSkills: ${skills}`;
}

export async function scoreJob(
  profile: Profile,
  posting: JobPosting
): Promise<JobScore> {
  const client = getAnthropic();
  const targetRoles = profile.preferences.target_roles?.length
    ? profile.preferences.target_roles.join(", ")
    : "(none specified)";

  const userText = [
    `# Candidate profile`,
    compactResume(profile.resume_struct),
    ``,
    `Candidate's stated target roles (use to anchor role_fit):`,
    targetRoles,
    ``,
    `# Job posting`,
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location: ${posting.location.raw}${posting.location.remote ? " (remote)" : ""}`,
    `Description:`,
    posting.description_md.slice(0, 4000),
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  const parsed = JSON.parse(cleaned) as {
    value: number;
    reasoning: string;
    dimensions: {
      role_fit?: number;
      skill_fit: number;
      level_fit: number;
      location_fit: number;
      comp_fit: number | null;
    };
  };

  return {
    job_id: posting.id,
    value: parsed.value,
    reasoning: parsed.reasoning,
    dimensions: {
      skill_fit: parsed.dimensions.skill_fit,
      level_fit: parsed.dimensions.level_fit,
      location_fit: parsed.dimensions.location_fit,
      comp_fit: parsed.dimensions.comp_fit ?? undefined,
    },
    scored_at: new Date().toISOString(),
    model: MODEL_HAIKU,
  };
}
