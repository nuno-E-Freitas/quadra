import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type UserRole } from "@/db/schema";

const COOKIE = "quadra_session";
const DAY = 86_400_000;
const LIFETIME = 30 * DAY;
/** Slide the expiry forward once a session is past its halfway point. */
const RENEW_BELOW = 15 * DAY;

export type SessionUser = { id: string; email: string; name: string; role: UserRole };

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
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, id),
        gt(sessions.expiresAt, new Date()),
        // A disabled account keeps its rows but stops being anyone, immediately
        // — the live cookie is refused rather than waiting for its expiry.
        isNull(users.disabledAt),
      ),
    )
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

  return { id: row.id, email: row.email, name: row.name, role: row.role };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Authorization lives here rather than in a layout: a layout does not re-render
 * on navigation and does not control whether the rest of the route runs, so a
 * check placed there is not a gate. Every caller of the data goes through these.
 */
export async function requireRole(...allowed: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/feed");
  return user;
}

/** Someone who may own drills and squads. Admins count — they can do anything. */
export function requireCoach() {
  return requireRole("admin", "coach");
}

export function requireAdmin() {
  return requireRole("admin");
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}
