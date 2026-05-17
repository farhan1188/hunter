import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";

export interface CoverLetterInput {
  profile_name: string;
  role_title: string;
  company_name: string;
  jd_summary: string;
  verbatim_phrase: string;
  max_words: number;
}

const SYSTEM_BASE = `You write concise, professional cover letters. Keep it under the
specified word count. Do not embellish; mention the candidate's enthusiasm and one or
two concrete points of fit. Sign with the candidate's name. Output the letter
markdown only, no preamble or explanation.`;

const SYSTEM_VERBATIM_CLAUSE = ` The letter MUST include the provided verbatim phrase
exactly as given (a substring, ≥5 words, drawn from the company's own public
materials).`;

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const hasVerbatim = input.verbatim_phrase.trim().length > 0;
  const system = hasVerbatim ? SYSTEM_BASE + SYSTEM_VERBATIM_CLAUSE : SYSTEM_BASE;

  const userText = [
    `Candidate name: ${input.profile_name}`,
    `Role: ${input.role_title} at ${input.company_name}`,
    ...(hasVerbatim
      ? [`Verbatim phrase to include (must appear as exact substring): "${input.verbatim_phrase}"`]
      : []),
    `Max words: ${input.max_words}`,
    ``,
    `Job description summary:`,
    input.jd_summary,
  ].join("\n");

  const res = await getAnthropic().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: userText }],
  });

  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim();
  return text;
}
