import type { Client } from "@libsql/client";
import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";

export interface DraftInput {
  target_name: string;
  role_title: string;
  company_name: string;
  jd_summary: string;
  candidate_summary: string;
}

const SYSTEM = `You write short, conversational LinkedIn DMs (75-100 words).
Lead with a specific reason you're interested in the role / company.
Mention one concrete relevant fit. Close with a soft ask to chat. NO hashtags.
NO emojis. Output the DM text only.`;

export async function draftMessage(input: DraftInput): Promise<string> {
  const userText = [
    `Target name: ${input.target_name}`,
    `Role: ${input.role_title} at ${input.company_name}`,
    `Candidate summary: ${input.candidate_summary}`,
    `JD summary: ${input.jd_summary}`,
  ].join("\n");
  const res = await getAnthropic().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });
  return res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim();
}

/** Convenience wrapper that pulls inputs from the DB. Used by /api route. */
export async function draftOutreach(db: Client, applicationId: string): Promise<string> {
  const { rows } = await db.execute({
    sql: `SELECT j.title, j.company_name, j.description_md, p.basics_json, p.resume_struct_json
            FROM applications a
            JOIN jobs j ON j.id = a.job_id
            JOIN profile p ON p.id = 1
           WHERE a.id = ?`,
    args: [applicationId],
  });
  if (rows.length === 0) throw new Error("application not found");
  const r = rows[0];
  const summary = "Senior product/engineering experience";  // crude default; refine in follow-up
  const draft = await draftMessage({
    target_name: "Hiring Manager",
    role_title: r.title as string,
    company_name: r.company_name as string,
    jd_summary: ((r.description_md as string) || "").slice(0, 600),
    candidate_summary: summary,
  });
  await db.execute({
    sql: `INSERT INTO outreach_drafts (application_id, target_name, message_md)
          VALUES (?, ?, ?)`,
    args: [applicationId, "Hiring Manager", draft],
  });
  return draft;
}
