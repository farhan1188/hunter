import { getAnthropic, MODEL_SONNET } from "@/src/llm/client";
import { ResumeStructSchema } from "@/src/core/schemas";
import type { ResumeStruct } from "@/src/core/types";

const SYSTEM = `You extract structured data from a resume PDF. Return JSON matching exactly:

{
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

For each bullet, populate "numbers" with EVERY distinct numeric token that appears in
that bullet's text (e.g. ["30%", "2M", "8"]). This array is the ONLY allowed source of
numbers when later tailoring this bullet — invented numbers are misrepresentation.

Return ONLY valid JSON. No prose. No code fences.`;

export async function extractResume(
  pdfBytes: Uint8Array
): Promise<ResumeStruct> {
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
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
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

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  const parsed = JSON.parse(cleaned);
  return ResumeStructSchema.parse(parsed);
}
