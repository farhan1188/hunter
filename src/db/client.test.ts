import { describe, it, expect } from "vitest";
import { getDb } from "./client";

const RUN = process.env.TURSO_DATABASE_URL ? describe : describe.skip;

RUN("db client", () => {
  it("connects and runs select 1", async () => {
    const db = getDb();
    const result = await db.execute("select 1 as one");
    expect(Number(result.rows[0].one)).toBe(1);
  });
});
