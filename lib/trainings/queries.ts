import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  drills,
  quartets,
  teams,
  trainingSessionItems,
  trainingSessions,
} from "@/db/schema";
import { requireUser, type SessionUser } from "@/lib/auth/session";

export async function getMyTrainings(userId: string) {
  return db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      scheduledFor: trainingSessions.scheduledFor,
      shareId: trainingSessions.shareId,
      updatedAt: trainingSessions.updatedAt,
      teamName: teams.name,
    })
    .from(trainingSessions)
    .leftJoin(teams, eq(teams.id, trainingSessions.teamId))
    .where(eq(trainingSessions.ownerId, userId))
    .orderBy(desc(trainingSessions.updatedAt))
    .limit(60);
}

/** Ownership is the gate here — a training is the coach's working document. */
export async function requireOwnedTraining(id: string): Promise<SessionUser> {
  const user = await requireUser();
  const [row] = await db
    .select({ ownerId: trainingSessions.ownerId })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .limit(1);
  if (!row || (row.ownerId !== user.id && user.role !== "admin")) notFound();
  return user;
}

export async function getTrainingItems(sessionId: string) {
  return db
    .select({
      drillId: drills.id,
      title: drills.title,
      kind: drills.kind,
      shareId: drills.shareId,
      scene: drills.scene,
      position: trainingSessionItems.position,
      note: trainingSessionItems.note,
      quartetId: trainingSessionItems.quartetId,
      quartetName: quartets.name,
    })
    .from(trainingSessionItems)
    .innerJoin(drills, eq(drills.id, trainingSessionItems.drillId))
    .leftJoin(quartets, eq(quartets.id, trainingSessionItems.quartetId))
    .where(eq(trainingSessionItems.sessionId, sessionId))
    .orderBy(asc(trainingSessionItems.position));
}

export async function getTraining(id: string) {
  const [row] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, id)).limit(1);
  if (!row) notFound();
  return row;
}

/** The public read: one link that carries the whole training. */
/** The blocks of the squad a training belongs to, if it belongs to one. */
export async function getTrainingQuartets(sessionId: string) {
  const [training] = await db
    .select({ teamId: trainingSessions.teamId })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);
  if (!training?.teamId) return [];

  return db
    .select({ id: quartets.id, name: quartets.name })
    .from(quartets)
    .where(eq(quartets.teamId, training.teamId))
    .orderBy(asc(quartets.position), asc(quartets.name));
}

export async function getTrainingByShareId(shareId: string) {
  const [row] = await db
    .select({
      id: trainingSessions.id,
      title: trainingSessions.title,
      description: trainingSessions.description,
      scheduledFor: trainingSessions.scheduledFor,
      teamId: trainingSessions.teamId,
      teamName: teams.name,
    })
    .from(trainingSessions)
    .leftJoin(teams, eq(teams.id, trainingSessions.teamId))
    .where(eq(trainingSessions.shareId, shareId))
    .limit(1);
  if (!row) return null;
  return { ...row, items: await getTrainingItems(row.id) };
}

/** Drills the coach owns that are not already in this training. */
export async function getAddableDrills(userId: string, sessionId: string) {
  const inSession = db
    .select({ drillId: trainingSessionItems.drillId })
    .from(trainingSessionItems)
    .where(eq(trainingSessionItems.sessionId, sessionId));

  return db
    .select({ id: drills.id, title: drills.title, kind: drills.kind })
    .from(drills)
    .where(and(eq(drills.ownerId, userId)))
    .orderBy(desc(drills.updatedAt))
    .limit(60)
    .then(async (rows) => {
      const taken = new Set((await inSession).map((r) => r.drillId));
      return rows.filter((r) => !taken.has(r.id));
    });
}
