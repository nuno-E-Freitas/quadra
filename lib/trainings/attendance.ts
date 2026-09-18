import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attendance, memberships, trainingSessions, users, type Attendance } from "@/db/schema";

export const ATTENDANCE_LABEL: Record<Attendance, string> = {
  vou: "Vou",
  duvida: "Dúvida",
  nao: "Não vou",
};

/** What this person has already answered for this training, if anything. */
export async function getMyAnswer(sessionId: string, userId: string) {
  const [row] = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(and(eq(attendance.sessionId, sessionId), eq(attendance.userId, userId)))
    .limit(1);
  return row?.status ?? null;
}

/**
 * The squad with each answer beside it, including the people who have not
 * answered — which is the half a coach actually chases on a Monday night.
 * Answers from outside the squad still show, so nobody who bothered to reply
 * disappears because they were moved between teams.
 */
export async function getAttendance(sessionId: string) {
  const [training] = await db
    .select({ teamId: trainingSessions.teamId })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);

  const answers = await db
    .select({
      userId: attendance.userId,
      name: users.name,
      status: attendance.status,
      respondedAt: attendance.respondedAt,
    })
    .from(attendance)
    .innerJoin(users, eq(users.id, attendance.userId))
    .where(eq(attendance.sessionId, sessionId));

  const squad = training?.teamId
    ? await db
        .select({ userId: users.id, name: users.name, number: memberships.number })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.teamId, training.teamId), eq(memberships.role, "player")))
        .orderBy(asc(users.name))
    : [];

  const byUser = new Map(answers.map((a) => [a.userId, a]));
  const rows = squad.map((player) => ({
    ...player,
    status: byUser.get(player.userId)?.status ?? null,
  }));

  const inSquad = new Set(squad.map((p) => p.userId));
  for (const answer of answers) {
    if (!inSquad.has(answer.userId)) {
      rows.push({ userId: answer.userId, name: answer.name, number: null, status: answer.status });
    }
  }

  const count = (status: Attendance) => rows.filter((r) => r.status === status).length;
  return {
    rows,
    vou: count("vou"),
    duvida: count("duvida"),
    nao: count("nao"),
    sem: rows.filter((r) => r.status === null).length,
  };
}
