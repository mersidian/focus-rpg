import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Next.js reads .env.local; drizzle-kit is a plain Node process and has to be
// told. Same precedence Next uses: .env.local wins, .env is the fallback.
config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Put your Neon connection string in .env.local, then run this again.",
  );
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
} satisfies Config;
