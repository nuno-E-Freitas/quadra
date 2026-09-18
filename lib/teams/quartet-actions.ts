"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { quartetMembers, quartets, trainingSessionItems, trainingSessions } from "@/db/schema";
import { requireOwnedTraining } from "@/lib/trainings/queries";
import { requireTeamCoach } from "./queries";

const name = z.string().trim().min(1).max(30);

export async function createQuartet(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) redirect(`/team/${teamId}`);

  const [{ top }] = await db
    .select({ top: max(quartets.position) })
    .from(quartets)
    .where(eq(quartets.teamId, teamId));

  await db.insert(quartets).values({ teamId, name: parsed.data, position: (top ?? 0) + 1 });

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function renameQuartet(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);
  const id = String(formData.get("id"));
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) redirect(`/team/${teamId}`);

  await db
    .update(quartets)
    .set({ name: parsed.data })
    .where(and(eq(quartets.id, id), eq(quartets.teamId, teamId)));

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function deleteQuartet(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);
  const id = String(formData.get("id"));

  await db.delete(quartets).where(and(eq(quartets.id, id), eq(quartets.teamId, teamId)));

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

/**
 * Put a player in a block, or take them out of all of them. A rotation only
 * means anything if each player is in one place, so joining one leaves the rest.
 */
export async function assignToQuartet(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);
  const userId = String(formData.get("userId"));
  const quartetId = String(formData.get("quartetId") ?? "").trim();

  const owned = await db
    .select({ id: quartets.id })
    .from(quartets)
    .where(eq(quartets.teamId, teamId));
  const ids = owned.map((q) => q.id);
  if (ids.length === 0) redirect(`/team/${teamId}`);

  await db.transaction(async (tx) => {
    await tx
      .delete(quartetMembers)
      .where(and(eq(quartetMembers.userId, userId), inArray(quartetMembers.quartetId, ids)));
    if (quartetId && ids.includes(quartetId)) {
      await tx.insert(quartetMembers).values({ quartetId, userId }).onConflictDoNothing();
    }
  });

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

/** Mark one item of a training as belonging to a block. */
export async function setItemQuartet(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);
  const drillId = String(formData.get("drillId"));
  const raw = String(formData.get("quartetId") ?? "").trim();

  const [training] = await db
    .select({ teamId: trainingSessions.teamId })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .limit(1);

  // Only a block of the squad this training belongs to.
  let quartetId: string | null = null;
  if (raw && training?.teamId) {
    const [owned] = await db
      .select({ id: quartets.id })
      .from(quartets)
      .where(and(eq(quartets.id, raw), eq(quartets.teamId, training.teamId)))
      .limit(1);
    quartetId = owned?.id ?? null;
  }

  await db
    .update(trainingSessionItems)
    .set({ quartetId })
    .where(and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, drillId)));

  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}
