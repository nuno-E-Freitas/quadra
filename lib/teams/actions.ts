"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { drills, invites, memberships, publications, teams, TEAM_ROLES } from "@/db/schema";
import { requireCoach, requireUser } from "@/lib/auth/session";
import { requireTeamCoach } from "./queries";

const DAY = 86_400_000;
const teamName = z.string().trim().min(1, "Give the squad a name.").max(80);
const teamRole = z.enum(TEAM_ROLES);

export async function createTeam(formData: FormData) {
  const user = await requireCoach();
  const parsed = teamName.safeParse(formData.get("name"));
  if (!parsed.success) redirect("/team");

  // The squad and its first coach are one fact; a team with nobody able to
  // administer it would be unreachable.
  const id = await db.transaction(async (tx) => {
    const [team] = await tx
      .insert(teams)
      .values({ name: parsed.data, ownerId: user.id })
      .returning({ id: teams.id });
    await tx.insert(memberships).values({ teamId: team.id, userId: user.id, role: "coach" });
    return team.id;
  });

  revalidatePath("/team");
  redirect(`/team/${id}`);
}

export async function renameTeam(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);
  const parsed = teamName.safeParse(formData.get("name"));
  if (!parsed.success) redirect(`/team/${teamId}`);

  await db.update(teams).set({ name: parsed.data }).where(eq(teams.id, teamId));
  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function createInvite(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const user = await requireTeamCoach(teamId);
  const role = teamRole.safeParse(formData.get("role"));

  await db.insert(invites).values({
    code: nanoid(10),
    teamId,
    role: role.success ? role.data : "player",
    createdBy: user.id,
    expiresAt: new Date(Date.now() + 14 * DAY),
  });

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function revokeInvite(formData: FormData) {
  const code = String(formData.get("code"));
  const [invite] = await db
    .select({ teamId: invites.teamId })
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);
  if (!invite) redirect("/team");

  await requireTeamCoach(invite.teamId);
  await db.delete(invites).where(eq(invites.code, code));

  revalidatePath(`/team/${invite.teamId}`);
  redirect(`/team/${invite.teamId}`);
}

/**
 * Redeem a join code as someone who already has an account. It never changes a
 * platform role — an existing coach who joins a squad as a player stays a coach
 * of their own work. A brand-new account takes its role from the invite at
 * signup instead.
 */
export async function joinTeam(code: string) {
  const user = await requireUser();

  const [invite] = await db
    .select({ teamId: invites.teamId, role: invites.role })
    .from(invites)
    .where(and(eq(invites.code, code), gt(invites.expiresAt, new Date())))
    .limit(1);
  if (!invite) return { ok: false as const, error: "That invite has expired or does not exist." };

  await db
    .insert(memberships)
    .values({ teamId: invite.teamId, userId: user.id, role: invite.role })
    .onConflictDoNothing();

  revalidatePath("/team");
  revalidatePath("/feed");
  return { ok: true as const, teamId: invite.teamId };
}

/** The button on /join/[code]. Joining must not happen just because a link was
 *  opened — a prefetch would then enrol people who only hovered it. */
export async function acceptInvite(formData: FormData) {
  const result = await joinTeam(String(formData.get("code")));
  if (!result.ok) redirect("/feed");
  redirect(`/team/${result.teamId}`);
}

export async function setMemberRole(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const userId = String(formData.get("userId"));
  await requireTeamCoach(teamId);
  const role = teamRole.safeParse(formData.get("role"));
  if (!role.success) redirect(`/team/${teamId}`);

  const [team] = await db.select({ ownerId: teams.ownerId }).from(teams).where(eq(teams.id, teamId)).limit(1);
  // The owner keeps the keys to their own squad; demoting them could leave it
  // with no coach at all.
  if (team?.ownerId === userId) redirect(`/team/${teamId}`);

  await db
    .update(memberships)
    .set({ role: role.data })
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)));

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function setMemberNumber(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const userId = String(formData.get("userId"));
  await requireTeamCoach(teamId);
  const number = String(formData.get("number") ?? "").trim().slice(0, 4) || null;

  await db
    .update(memberships)
    .set({ number })
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)));

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function removeMember(formData: FormData) {
  const teamId = String(formData.get("teamId"));
  const userId = String(formData.get("userId"));
  await requireTeamCoach(teamId);

  const [team] = await db.select({ ownerId: teams.ownerId }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (team?.ownerId === userId) redirect(`/team/${teamId}`);

  await db
    .delete(memberships)
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, userId)));

  revalidatePath(`/team/${teamId}`);
  redirect(`/team/${teamId}`);
}

export async function leaveTeam(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId"));

  const [team] = await db.select({ ownerId: teams.ownerId }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (team?.ownerId === user.id) redirect(`/team/${teamId}`);

  await db
    .delete(memberships)
    .where(and(eq(memberships.teamId, teamId), eq(memberships.userId, user.id)));

  revalidatePath("/team");
  revalidatePath("/feed");
  redirect("/team");
}

/**
 * Publishing is the whole point of the squad: it is what puts a drill in the
 * players' feed. It needs both halves — your drill, your squad — so a coach
 * cannot push someone else's work, nor their own into a squad they don't run.
 */
export async function publishDrill(formData: FormData) {
  const user = await requireUser();
  const drillId = String(formData.get("drillId"));
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);

  const [drill] = await db
    .select({ ownerId: drills.ownerId })
    .from(drills)
    .where(eq(drills.id, drillId))
    .limit(1);
  if (!drill || (drill.ownerId !== user.id && user.role !== "admin")) redirect(`/drills/${drillId}`);

  await db.insert(publications).values({ drillId, teamId }).onConflictDoNothing();

  revalidatePath(`/drills/${drillId}`);
  revalidatePath("/feed");
  redirect(`/drills/${drillId}`);
}

export async function unpublishDrill(formData: FormData) {
  const user = await requireUser();
  const drillId = String(formData.get("drillId"));
  const teamId = String(formData.get("teamId"));
  await requireTeamCoach(teamId);

  const [drill] = await db
    .select({ ownerId: drills.ownerId })
    .from(drills)
    .where(eq(drills.id, drillId))
    .limit(1);
  if (!drill || (drill.ownerId !== user.id && user.role !== "admin")) redirect(`/drills/${drillId}`);

  await db
    .delete(publications)
    .where(and(eq(publications.drillId, drillId), eq(publications.teamId, teamId)));

  revalidatePath(`/drills/${drillId}`);
  revalidatePath("/feed");
  redirect(`/drills/${drillId}`);
}
