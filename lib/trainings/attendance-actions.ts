"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ATTENDANCE, attendance, memberships, trainingSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";

/**
 * Answer "am I coming". Anyone holding the link can read a training; answering
 * needs an account, because an attendance list of anonymous yeses counts
 * nothing. When the training belongs to a squad, only that squad answers — the
 * link travels, and a coach's list should not fill with people who are not in
 * the team.
 */
export async function setAttendance(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId"));
  const shareId = String(formData.get("shareId") ?? "");
  const status = z.enum(ATTENDANCE).safeParse(formData.get("status"));
  if (!status.success) return;

  const [training] = await db
    .select({ id: trainingSessions.id, teamId: trainingSessions.teamId, ownerId: trainingSessions.ownerId })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);
  if (!training) return;

  if (training.teamId && training.ownerId !== user.id) {
    const [member] = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.teamId, training.teamId), eq(memberships.userId, user.id)))
      .limit(1);
    if (!member) return;
  }

  await db
    .insert(attendance)
    .values({ sessionId, userId: user.id, status: status.data })
    .onConflictDoUpdate({
      target: [attendance.sessionId, attendance.userId],
      set: { status: status.data, respondedAt: new Date() },
    });

  if (shareId) revalidatePath(`/t/${shareId}`);
  revalidatePath(`/trainings/${sessionId}`);
}
