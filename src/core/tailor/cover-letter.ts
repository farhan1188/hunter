import { getAnthropic, MODEL_SONNET } from "@/src/llm/client";

export interface CoverLetterInput {
  profile_name: string;
  role_title: string;
  company_name: string;
  jd_summary: string;
  verbatim_phrase: string;
  max_words: number;
  // Optional: 2-4 of the candidate's most JD-relevant resume bullets, used to
  // ground the letter in real accomplishments instead of generic enthusiasm.
  highlight_bullets?: string[];
}

const SYSTEM_BASE = `You write cover letters that sound like the candidate actually wrote them — not like an AI assistant or a corporate recruiter.

VOICE
- First-person, direct, slightly informal. Like a smart engineer talking to another engineer over coffee.
- Specific over abstract. Reference one or two real accomplishments from the candidate's resume if provided, with their actual numbers.
- Show that you understand what the role is and why it's interesting. Don't compliment the company in vague ways.
- Vary sentence length. Some short. Some longer that carry one connected thought to the end.

HARD BANS
- No em dashes (—) or en dashes (–). Use a comma, a period, or parentheses.
- No "I am writing to express my interest in..." or any variant
- No "I am excited to apply for the [role] position at [company]" opening
- No "I would welcome the opportunity to discuss..."
- No "passionate about", "leverage", "synergy", "delve", "robust", "cutting-edge", "best-in-class", "world-class"
- No "Moreover", "Furthermore", "Additionally" as paragraph openers
- No "In closing" or "In conclusion"
- No tricolons (X, Y, and Z) more than once in the whole letter
- No sycophancy about the company's mission unless you can be specific

STRUCTURE
- 3 short paragraphs, ~80 words each
- Open with a specific reason this role interests you (not "I am applying for...")
- Middle paragraph: one or two concrete things from your background that map to the role
- Close: short, confident, not desperate. "Happy to share more detail on X if useful." or similar.

FORMAT
- Output ONLY the letter body (no greeting like "Dear Hiring Manager" unless it fits the candidate's voice — keep it minimal if used).
- End with the candidate's actual name on its own line. NO placeholders like [Your Name] or [Candidate Name].
- Output markdown only, no preamble or explanation.`;

const SYSTEM_VERBATIM_CLAUSE = `

ADDITIONAL: include the provided verbatim phrase exactly as given (≥5 words from the company's own public materials), worked in naturally.`;

// Belt-and-braces cleanup: strip any em/en dashes the model produced anyway,
// drop obvious placeholders, normalize whitespace. Cheap and safe.
function cleanLetter(text: string): string {
  return text
    .replace(/\s*—\s*/g, ", ")                            // " — " or "—" → ", "
    .replace(/–/g, "-")                                     // en dash → hyphen
    .replace(/\[\s*(your name|candidate name|name)\s*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")                            // collapse runs of spaces
    .replace(/ ,/g, ",")                                    // tidy " ,"
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const hasVerbatim = input.verbatim_phrase.trim().length > 0;
  const system = hasVerbatim ? SYSTEM_BASE + SYSTEM_VERBATIM_CLAUSE : SYSTEM_BASE;

  const lines: string[] = [
    `Candidate name (use this exact name to sign off): ${input.profile_name}`,
    `Role: ${input.role_title} at ${input.company_name}`,
    `Max words: ${input.max_words}`,
  ];
  if (hasVerbatim) {
    lines.push(`Verbatim phrase to include (must appear as exact substring): "${input.verbatim_phrase}"`);
  }
  if (input.highlight_bullets && input.highlight_bullets.length > 0) {
    lines.push("", "Most relevant accomplishments from the candidate's resume (use the numbers exactly as given, don't invent):");
    for (const b of input.highlight_bullets) lines.push(`- ${b}`);
  }
  lines.push("", "Job description summary:", input.jd_summary);

  const res = await getAnthropic().messages.create({
    model: MODEL_SONNET,
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const raw = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("");
  return cleanLetter(raw);
}
