import type { Client } from "@libsql/client";

export interface QaEntry {
  id: number;
  pattern: string;
  answer: string;
  user_verified: boolean;
  deny_list: boolean;
  last_used: string | null;
}

export async function listKb(db: Client): Promise<QaEntry[]> {
  const { rows } = await db.execute(`
    SELECT id, pattern, answer, user_verified, deny_list, last_used FROM qa_kb ORDER BY pattern
  `);
  return rows.map((r) => ({
    id: r.id as number,
    pattern: r.pattern as string,
    answer: r.answer as string,
    user_verified: (r.user_verified as number) === 1,
    deny_list: (r.deny_list as number) === 1,
    last_used: (r.last_used as string) || null,
  }));
}

export async function upsertAnswer(
  db: Client,
  pattern: string,
  answer: string
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO qa_kb (pattern, answer, user_verified, deny_list)
          VALUES (?, ?, 1, 0)
          ON CONFLICT(pattern) DO UPDATE SET answer = excluded.answer, user_verified = 1, deny_list = 0`,
    args: [pattern, answer],
  });
}

/** Used by submitter: find a user-verified answer for a form question. */
export async function findAnswer(db: Client, question: string): Promise<string | null> {
  const { rows } = await db.execute({
    sql: `SELECT pattern, answer FROM qa_kb WHERE user_verified = 1 AND deny_list = 0`,
    args: [],
  });
  const lower = question.toLowerCase();
  for (const r of rows) {
    const p = (r.pattern as string).toLowerCase();
    if (lower.includes(p)) return r.answer as string;
  }
  return null;
}
