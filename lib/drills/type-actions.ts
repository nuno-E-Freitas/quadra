"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { drillTypes, drills } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { SUGGESTED_TYPES } from "./types";

const typeName = z.string().trim().min(1).max(40);

export async function createDrillType(formData: FormData) {
  const user = await requireCoach();
  const parsed = typeName.safeParse(formData.get("name"));
  if (!parsed.success) redirect("/types");

  const [{ top }] = await db
    .select({ top: max(drillTypes.position) })
    .from(drillTypes)
    .where(eq(drillTypes.ownerId, user.id));

  // The same name twice is a no-op rather than an error: the coach meant to
  // have that type, and they do.
  await db
    .insert(drillTypes)
    .values({ ownerId: user.id, name: parsed.data, position: (top ?? 0) + 1 })
    .onConflictDoNothing();

  revalidatePath("/types");
  revalidatePath("/drills");
  redirect("/types");
}

export async function seedDefaultTypes() {
  const user = await requireCoach();

  await db
    .insert(drillTypes)
    .values(SUGGESTED_TYPES.map((name, i) => ({ ownerId: user.id, name, position: i + 1 })))
    .onConflictDoNothing();

  revalidatePath("/types");
  revalidatePath("/drills");
  redirect("/types");
}

export async function renameDrillType(formData: FormData) {
  const user = await requireCoach();
  const id = String(formData.get("id"));
  const parsed = typeName.safeParse(formData.get("name"));
  if (!parsed.success) redirect("/types");

  // Scoped by owner, so one coach cannot rename another's vocabulary.
  await db
    .update(drillTypes)
    .set({ name: parsed.data })
    .where(and(eq(drillTypes.id, id), eq(drillTypes.ownerId, user.id)));

  revalidatePath("/types");
  revalidatePath("/drills");
  redirect("/types");
}

/** The plays survive: type_id is ON DELETE SET NULL, so they become untyped. */
export async function deleteDrillType(formData: FormData) {
  const user = await requireCoach();
  const id = String(formData.get("id"));

  await db.delete(drillTypes).where(and(eq(drillTypes.id, id), eq(drillTypes.ownerId, user.id)));

  revalidatePath("/types");
  revalidatePath("/drills");
  redirect("/types");
}

export async function setDrillType(formData: FormData) {
  const user = await requireCoach();
  const drillId = String(formData.get("drillId"));
  const raw = String(formData.get("typeId") ?? "").trim();

  // Only a type the coach owns, so a guessed id cannot borrow someone else's.
  let typeId: string | null = null;
  if (raw) {
    const [owned] = await db
      .select({ id: drillTypes.id })
      .from(drillTypes)
      .where(and(eq(drillTypes.id, raw), eq(drillTypes.ownerId, user.id)))
      .limit(1);
    typeId = owned?.id ?? null;
  }

  await db
    .update(drills)
    .set({ typeId, updatedAt: new Date() })
    .where(and(eq(drills.id, drillId), eq(drills.ownerId, user.id)));

  revalidatePath("/drills");
  revalidatePath("/drills/" + drillId);
  redirect("/drills/" + drillId);
}
