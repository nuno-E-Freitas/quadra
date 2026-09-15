import { cache } from "react";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { drills, invites, memberships, publications, teams, users } from "@/db/schema";
import { requireUser, type SessionUser } from "@/lib/auth/session";

/** Every squad this person belongs to, in either capacity. */
export const getMyTeams = cache(async (userId: string) => {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      role: memberships.role,
      ownerId: teams.ownerId,
      members: count(),
    })
    .from(memberships)
    .innerJoin(teams, eq(teams.id, memberships.teamId))
    .where(eq(memberships.userId, userId))
    .groupBy(teams.id, teams.name, memberships.role, teams.ownerId)
    .orderBy(teams.name);
});

export const getMembership = cache(async (teamId: string, userId: string) => {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)))
    .limit(1);
  return row ?? null;
});

/**
 * The gate for anything that changes a squad. An admin passes without being a
 * member; anyone else has to hold the coach role *on that team*, so coaching
 * one squad grants nothing over another.
 */
export async function requireTeamCoach(teamId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  const membership = await getMembership(teamId, user.id);
  // notFound, not a redirect: a squad you may not touch should not announce
  // that it exists.
  if (membership?.role !== "coach") notFound();
  return user;
}

export async function requireTeamMember(teamId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (!(await getMembership(teamId, user.id))) notFound();
  return user;
}

export async function getTeamDetail(teamId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) notFound();

  const roster = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      number: memberships.number,
      disabledAt: users.disabledAt,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.teamId, teamId))
    .orderBy(memberships.role, users.name);

  const open = await db
    .select({
      code: invites.code,
      role: invites.role,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .where(and(eq(invites.teamId, teamId), gt(invites.expiresAt, new Date())))
    .orderBy(desc(invites.createdAt));

  return { team, roster, invites: open };
}

/** What a player actually opens: everything published to any squad they are in. */
export const getFeed = cache(async (userId: string) => {
  return db
    .select({
      id: drills.id,
      title: drills.title,
      kind: drills.kind,
      shareId: drills.shareId,
      scene: drills.scene,
      teamName: teams.name,
      publishedAt: publications.publishedAt,
    })
    .from(publications)
    .innerJoin(drills, eq(drills.id, publications.drillId))
    .innerJoin(teams, eq(teams.id, publications.teamId))
    .innerJoin(
      memberships,
      and(eq(memberships.teamId, publications.teamId), eq(memberships.userId, userId)),
    )
    .orderBy(desc(publications.publishedAt))
    .limit(100);
});

/** Which of the coach's squads a given drill is already published to. */
export async function getDrillPublications(drillId: string) {
  return db
    .select({ teamId: publications.teamId, name: teams.name })
    .from(publications)
    .innerJoin(teams, eq(teams.id, publications.teamId))
    .where(eq(publications.drillId, drillId));
}
