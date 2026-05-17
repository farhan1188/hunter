import { getAnthropic, MODEL_SONNET } from "@/src/llm/client";
import { ResumeStructSchema } from "@/src/core/schemas";
import type { ResumeStruct } from "@/src/core/types";

const SYSTEM = `You extract structured data from a resume. Return JSON matching exactly:

{
  "summary": string,
  "experience": [
    {
      "company": string,
      "title": string,
      "start": string (YYYY-MM),
      "end": string | null (YYYY-MM, null if current),
      "bullets": [ { "text": string, "numbers": string[] } ]
    }
  ],
  "projects": [ { "name": string, "bullets": [ { "text": string, "numbers": string[] } ] } ],
  "skills": { "primary": string[], "secondary": string[] },
  "education": [ { "school": string, "degree": string, "year": string } ]
}

EXTRACTION RULES
- "summary": copy the professional summary / about-me section verbatim if present (typically appears near the top under a heading like "PROFESSIONAL SUMMARY", "SUMMARY", or "ABOUT"). Use "" if absent.
- "experience": include EVERY role listed, even if it has no bullets in the resume (some current roles list only title + dates). Roles with no bullets get "bullets": [].
- "projects": include EVERY personal/side project. Same bullet rules.
- For each bullet, populate "numbers" with EVERY distinct numeric token (e.g. ["30%", "2M", "8", "20+", "$1.5M"]). This is the ONLY allowed source when later tailoring the bullet — invented numbers are misrepresentation. INCLUDE the suffix in the number string ("20+" not "20").
- "skills.primary": the candidate's core skills (most frequently cited, headlined in the resume). "secondary": everything else.

Return ONLY valid JSON. No prose. No code fences.`;

function parseExtractedJson(text: string): ResumeStruct {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return ResumeStructSchema.parse(JSON.parse(json));
}

export async function extractResume(pdfBytes: Uint8Array): Promise<ResumeStruct> {
  const client = getAnthropic();
  const base64 = Buffer.from(pdfBytes).toString("base64");

  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: "Extract this resume into the JSON schema above." },
        ],
      },
    ],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  return parseExtractedJson(text);
}

export async function extractResumeFromText(resumeText: string): Promise<ResumeStruct> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: MODEL_SONNET,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract this resume into the JSON schema above.\n\nResume text:\n\n${resumeText}`,
      },
    ],
  });
  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  return parseExtractedJson(text);
}
