import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * The Auth.js Drizzle adapter inspects the client at module load, so this has to
 * be a real instance rather than a lazy proxy. When DATABASE_URL is absent the
 * client points at a hostname that cannot resolve: `next build` (which never
 * queries — every page is dynamic) succeeds, and any real query fails loudly
 * with the missing variable named in the host.
 */
const PLACEHOLDER =
  "postgresql://unset:unset@set-DATABASE_URL-in-your-env.invalid/unset?sslmode=require";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[focus-rpg] DATABASE_URL is not set — copy .env.example to .env.local and paste your Neon connection string.",
  );
}

const RETRIES = 3;
const BACKOFF_MS = [120, 400];

/**
 * Neon scales its compute to zero when idle and wakes on the next request (§2),
 * so the first query after a quiet spell — or one sent over a phone's patchy
 * connection — can fail at the transport before the database ever sees it.
 *
 * Those are retried. A query the database actually answered is not: an error
 * with a response behind it is a real error and must surface unchanged.
 */
async function fetchWithRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      const wait = BACKOFF_MS[attempt];
      if (wait === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

neonConfig.fetchFunction = fetchWithRetry;

export const db = drizzle(neon(process.env.DATABASE_URL ?? PLACEHOLDER), { schema });
export { schema };
