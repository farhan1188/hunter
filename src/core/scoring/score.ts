import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import type {
  JobPosting,
  Profile,
  JobScore,
  ResumeStruct,
} from "@/src/core/types";

const SYSTEM = `You score a job posting against a candidate's profile from 0–100.

Dimensions (each 0–100):
- skill_fit: technical & domain match between candidate's skills and the JD
- level_fit: seniority alignment (intern << junior << mid << senior << staff << principal)
- location_fit: how well the location/remote situation matches preferences
- comp_fit (optional, only if JD mentions salary): does it meet the candidate's min?

Overall score: weighted average — skill 40%, level 30%, location 20%, comp 10%
(or skill 45%, level 35%, location 20% if comp not provided).

Return JSON ONLY (no code fences, no prose):
{
  "value": <integer 0–100>,
  "reasoning": "1–2 sentences",
  "dimensions": { "skill_fit": <int>, "level_fit": <int>, "location_fit": <int>, "comp_fit": <int|null> }
}`;

function compactResume(s: ResumeStruct | undefined): string {
  if (!s) return "(no structured resume yet)";
  const exp = s.experience
    .map(
      (e) => `${e.title} @ ${e.company} (${e.start}–${e.end ?? "now"})`
    )
    .join("; ");
  const skills = [...s.skills.primary, ...s.skills.secondary].join(", ");
  return `Experience: ${exp}\nSkills: ${skills}`;
}

export async function scoreJob(
  profile: Profile,
  posting: JobPosting
): Promise<JobScore> {
  const client = getAnthropic();
  const userText = [
    `# Candidate profile`,
    compactResume(profile.resume_struct),
    `Preferences: ${JSON.stringify(profile.preferences)}`,
    ``,
    `# Job`,
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location: ${posting.location.raw}${posting.location.remote ? " (remote)" : ""}`,
    `Description:`,
    posting.description_md.slice(0, 4000),
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 500,
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
