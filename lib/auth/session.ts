import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const COOKIE = "quadra_session";
const DAY = 86_400_000;
const LIFETIME = 30 * DAY;
/** Slide the expiry forward once a session is past its halfway point. */
const RENEW_BELOW = 15 * DAY;

export type SessionUser = { id: string; email: string; name: string };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * The cookie holds a random token; the table holds only its hash. Someone who
 * reads the database still cannot log in as anyone.
 */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LIFETIME);

  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Deduped per request, so a layout and three pages cost one query. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const id = sha256(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt.getTime() - Date.now() < RENEW_BELOW) {
    const expiresAt = new Date(Date.now() + LIFETIME);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, row.sessionId));
    try {
      (await cookies()).set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: expiresAt,
      });
    } catch {
      // Rendering a Server Component cannot set cookies; the row is already
      // extended, so the cookie catches up on the next action or route handler.
    }
  }

  return { id: row.id, email: row.email, name: row.name };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}
