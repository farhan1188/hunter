import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import type { VisaCategory, JobPosting } from "@/src/core/types";

const SYSTEM = `You classify a job posting for visa requirements and target timezone.

Return JSON ONLY (no code fences, no prose):
{
  "category": "country_specific" | "sponsorship_offered" | "international_remote" | "unknown",
  "target_countries": string[],
  "target_timezone": string|null
}

Rules:
- "Must be authorized to work in [X]" / "based in [X]" / "[X] residents only" → category="country_specific", target_countries=[X codes lowercase]
- "Sponsorship available" / "visa sponsorship" / "H-1B sponsorship" → category="sponsorship_offered", target_countries=[the country offering it]
- "Remote, anywhere" / "Worldwide" / "Hire globally" / "EOR-friendly" → category="international_remote", target_countries=[]
- If unclear: category="unknown", target_countries=[]

target_countries are ISO 3166-1 alpha-2 codes, lowercase (e.g. "us", "uk", "de").

Timezone: infer IANA TZ from office locations or explicit timezone mentions
(e.g. "America/New_York", "Europe/Berlin"). null if ambiguous.`;

export interface VisaClassification {
  category: VisaCategory;
  target_countries: string[];
  target_timezone: string | null;
}

export async function classifyVisa(
  posting: Pick<JobPosting, "title" | "company" | "location" | "description_md">
): Promise<VisaClassification> {
  const client = getAnthropic();
  const text = [
    `Title: ${posting.title}`,
    `Company: ${posting.company.name}`,
    `Location field: ${posting.location.raw}`,
    `Description (first 3000 chars):`,
    posting.description_md.slice(0, 3000),
  ].join("\n");

  const res = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 200,
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });

  const out = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  const parsed = JSON.parse(out) as VisaClassification;
  return {
    category: parsed.category,
    target_countries: (parsed.target_countries ?? []).map((c) =>
      c.toLowerCase()
    ),
    target_timezone: parsed.target_timezone || null,
  };
}
