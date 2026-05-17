// One-shot: extract basics (name, email, phone, location, links) from the same
// .docx and merge into profile.basics_json.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import { getAnthropic, MODEL_HAIKU } from "@/src/llm/client";
import { getDb } from "@/src/db/client";

const SYSTEM = `You extract contact basics from a resume. Output JSON ONLY (no prose, no fences):
{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "links": string[]
}
Use empty string / [] if a field is absent. Links should be full URLs (LinkedIn, GitHub, portfolio).`;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error("usage: tsx scripts/import-basics-docx.ts <path-to-docx>"); process.exit(1); }

  const buffer = await readFile(filePath);
  const { value: text } = await mammoth.extractRawText({ buffer });
  const head = text.slice(0, 1500);
  console.log("first 400 chars of resume:\n", head.slice(0, 400));

  const res = await getAnthropic().messages.create({
    model: MODEL_HAIKU,
    max_tokens: 500,
    system: SYSTEM,
    messages: [{ role: "user", content: head }],
  });
  const out = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  const json = start >= 0 && end > start ? out.slice(start, end + 1) : out;
  const basics = JSON.parse(json);
  console.log("\nextracted basics:", basics);

  const db = getDb();
  const { rows } = await db.execute("SELECT basics_json FROM profile WHERE id = 1");
  const existing = JSON.parse((rows[0]?.basics_json as string) ?? "{}");
  const merged = {
    name: basics.name || existing.name || "",
    email: basics.email || existing.email || "",
    phone: basics.phone || existing.phone || "",
    location: basics.location || existing.location || "",
    links: basics.links?.length ? basics.links : (existing.links ?? []),
  };
  await db.execute({
    sql: "UPDATE profile SET basics_json = ? WHERE id = 1",
    args: [JSON.stringify(merged)],
  });
  console.log("\nsaved basics:", merged);
}

main().catch((e) => { console.error(e); process.exit(1); });
