import { createClient, type Client } from "@libsql/client";

/**
 * libSQL client. NOT a singleton — Next.js fetch caching can serve stale data
 * to a cached client between requests. Returning a fresh client each call keeps
 * the @libsql/client side honest. HTTP request cost per call is small.
 *
 * Uses the FULL token by default (Hub does reads + writes).
 * Routines instantiate their own client with their scoped token.
 */
export function getDb(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN_FULL;
  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN_FULL must be set (see docs/setup.md)"
    );
  }
  return createClient({ url, authToken });
}
