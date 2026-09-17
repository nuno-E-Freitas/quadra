import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");

// Next dev reloads modules on every edit; without the global the pool leaks
// connections until Postgres refuses new ones.
const globalForDb = globalThis as unknown as { __quadraSql?: ReturnType<typeof postgres> };
const client =
  globalForDb.__quadraSql ??
  postgres(url, {
    /**
     * A serverless instance serves one request at a time, so a pool of ten
     * there is nine connections held open against the Neon pooler for nothing —
     * multiplied by however many instances the platform decides to wake.
     */
    max: process.env.VERCEL ? 1 : 10,
    /**
     * Nothing closes a connection on a platform that freezes the process
     * between requests, so let idle ones lapse instead of accumulating.
     */
    idle_timeout: 20,
    connect_timeout: 15,
  });
if (process.env.NODE_ENV !== "production") globalForDb.__quadraSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
