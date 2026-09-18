import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quartetMembers, quartets, users } from "@/db/schema";

/** Every block in a squad, with who is in it. */
export async function getQuartets(teamId: string) {
  const blocks = await db
    .select({ id: quartets.id, name: quartets.name, position: quartets.position })
    .from(quartets)
    .where(eq(quartets.teamId, teamId))
    .orderBy(asc(quartets.position), asc(quartets.name));

  if (blocks.length === 0) return [];

  const members = await db
    .select({ quartetId: quartetMembers.quartetId, userId: users.id, name: users.name })
    .from(quartetMembers)
    .innerJoin(users, eq(users.id, quartetMembers.userId))
    .innerJoin(quartets, eq(quartets.id, quartetMembers.quartetId))
    .where(eq(quartets.teamId, teamId))
    .orderBy(asc(users.name));

  return blocks.map((block) => ({
    ...block,
    members: members.filter((m) => m.quartetId === block.id),
  }));
}

/** Which block each player of this squad is in, keyed by user. */
export async function getQuartetByUser(teamId: string) {
  const rows = await db
    .select({ userId: quartetMembers.userId, quartetId: quartets.id, name: quartets.name })
    .from(quartetMembers)
    .innerJoin(quartets, eq(quartets.id, quartetMembers.quartetId))
    .where(eq(quartets.teamId, teamId));

  return new Map(rows.map((r) => [r.userId, { id: r.quartetId, name: r.name }]));
}
