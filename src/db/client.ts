import { createClient, type Client } from "@libsql/client";

let cached: Client | null = null;

/**
 * libSQL client. Singleton so we share one HTTP connection.
 * Uses the FULL token by default (Hub does reads + writes).
 * Routines instantiate their own client with their scoped token.
 */
export function getDb(): Client {
  if (cached) return cached;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN_FULL;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN_FULL must be set (see docs/setup.md)"
    );
  }
  cached = createClient({ url, authToken });
  return cached;
}
