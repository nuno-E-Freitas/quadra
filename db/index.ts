import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — copy .env.example to .env");

// Next dev reloads modules on every edit; without the global the pool leaks
// connections until Postgres refuses new ones.
const globalForDb = globalThis as unknown as { __quadraSql?: ReturnType<typeof postgres> };
const client = globalForDb.__quadraSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.__quadraSql = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
