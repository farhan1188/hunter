import { createClient, type Client } from "@libsql/client";

/**
 * libSQL client. NOT a singleton, and overrides the default global fetch to
 * `cache: 'no-store'` — Next.js otherwise caches the underlying libSQL HTTP
 * responses and serves stale data to server components, even with `dynamic = "force-dynamic"`.
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
  return createClient({
    url,
    authToken,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store" })) as typeof fetch,
  });
}
