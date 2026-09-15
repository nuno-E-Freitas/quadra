"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, max, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { drills, trainingSessionItems, trainingSessions } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { requireTeamCoach } from "@/lib/teams/queries";
import { requireOwnedTraining } from "./queries";

const title = z.string().trim().min(1).max(120);

export async function createTraining(formData: FormData) {
  const user = await requireCoach();
  const parsed = title.safeParse(formData.get("title"));

  const [created] = await db
    .insert(trainingSessions)
    .values({
      ownerId: user.id,
      title: parsed.success ? parsed.data : "Untitled training",
      shareId: nanoid(12),
    })
    .returning({ id: trainingSessions.id });

  revalidatePath("/trainings");
  redirect(`/trainings/${created.id}`);
}

export async function updateTraining(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);

  const parsed = title.safeParse(formData.get("title"));
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  const when = String(formData.get("scheduledFor") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();

  // Attaching a training to a squad is an act of publishing, so it needs the
  // same authority as publishing a drill there.
  if (teamId) await requireTeamCoach(teamId);

  await db
    .update(trainingSessions)
    .set({
      title: parsed.success ? parsed.data : "Untitled training",
      description,
      scheduledFor: when ? new Date(when) : null,
      teamId: teamId || null,
      updatedAt: new Date(),
    })
    .where(eq(trainingSessions.id, id));

  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}

export async function deleteTraining(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);
  await db.delete(trainingSessions).where(eq(trainingSessions.id, id));
  revalidatePath("/trainings");
  redirect("/trainings");
}

export async function addDrillToTraining(formData: FormData) {
  const id = String(formData.get("id"));
  const user = await requireOwnedTraining(id);
  const drillId = String(formData.get("drillId"));

  const [drill] = await db
    .select({ ownerId: drills.ownerId })
    .from(drills)
    .where(eq(drills.id, drillId))
    .limit(1);
  if (!drill || (drill.ownerId !== user.id && user.role !== "admin")) redirect(`/trainings/${id}`);

  const [{ top }] = await db
    .select({ top: max(trainingSessionItems.position) })
    .from(trainingSessionItems)
    .where(eq(trainingSessionItems.sessionId, id));

  await db
    .insert(trainingSessionItems)
    .values({ sessionId: id, drillId, position: (top ?? 0) + 1 })
    .onConflictDoNothing();

  await touch(id);
  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}

export async function removeDrillFromTraining(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);
  const drillId = String(formData.get("drillId"));

  await db
    .delete(trainingSessionItems)
    .where(and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, drillId)));

  await touch(id);
  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}

export async function setItemNote(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);
  const drillId = String(formData.get("drillId"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  await db
    .update(trainingSessionItems)
    .set({ note })
    .where(and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, drillId)));

  await touch(id);
  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}

/**
 * Reorder by swapping positions with the neighbour. Two rows change, no
 * renumbering pass, and the order survives a drill being pulled out of the
 * middle because only the relative order is ever read.
 */
export async function moveItem(formData: FormData) {
  const id = String(formData.get("id"));
  await requireOwnedTraining(id);
  const drillId = String(formData.get("drillId"));
  const up = formData.get("direction") === "up";

  const rows = await db
    .select({ drillId: trainingSessionItems.drillId, position: trainingSessionItems.position })
    .from(trainingSessionItems)
    .where(eq(trainingSessionItems.sessionId, id))
    .orderBy(trainingSessionItems.position);

  const index = rows.findIndex((r) => r.drillId === drillId);
  const other = up ? rows[index - 1] : rows[index + 1];
  if (index === -1 || !other) redirect(`/trainings/${id}`);

  await db.transaction(async (tx) => {
    await tx
      .update(trainingSessionItems)
      .set({ position: sql`-1` })
      .where(
        and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, drillId)),
      );
    await tx
      .update(trainingSessionItems)
      .set({ position: rows[index].position })
      .where(
        and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, other.drillId)),
      );
    await tx
      .update(trainingSessionItems)
      .set({ position: other.position })
      .where(
        and(eq(trainingSessionItems.sessionId, id), eq(trainingSessionItems.drillId, drillId)),
      );
  });

  await touch(id);
  revalidatePath(`/trainings/${id}`);
  redirect(`/trainings/${id}`);
}

function touch(id: string) {
  return db
    .update(trainingSessions)
    .set({ updatedAt: new Date() })
    .where(eq(trainingSessions.id, id));
}
