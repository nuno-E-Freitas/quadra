"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { drillTypes } from "@/db/schema";
import { DEFAULT_TITLE, newScene } from "@/lib/presets";
import { getPitchDefaults } from "@/lib/settings/queries";
import { validateScene, type SceneKind } from "@/lib/scene";

export type SaveResult = { ok: true; savedAt: number } | { ok: false; error: string };

export async function createDrill(formData: FormData) {
  const user = await requireCoach();
  const kind = (formData.get("kind") === "training" ? "training" : "play") as SceneKind;

  // Naming it at birth beats "Jogada sem nome" sitting in the library for weeks;
  // the editor can still rename it afterwards.
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || DEFAULT_TITLE[kind];

  const rawType = String(formData.get("typeId") ?? "").trim();
  let typeId: string | null = null;
  if (rawType) {
    const [owned] = await db
      .select({ id: drillTypes.id })
      .from(drillTypes)
      .where(and(eq(drillTypes.id, rawType), eq(drillTypes.ownerId, user.id)))
      .limit(1);
    typeId = owned?.id ?? null;
  }

  const [created] = await db
    .insert(drills)
    .values({
      ownerId: user.id,
      kind,
      typeId,
      title,
      scene: newScene(kind, await getPitchDefaults(user.id)),
      shareId: nanoid(12),
    })
    .returning({ id: drills.id });

  revalidatePath("/drills");
  redirect(`/drills/${created.id}`);
}

export async function saveDrill(
  id: string,
  input: { title: string; scene: unknown },
): Promise<SaveResult> {
  const user = await requireCoach();

  const title = input.title.trim().slice(0, 120) || "Sem nome";
  const validated = validateScene(input.scene);
  if (!validated.success) {
    return { ok: false, error: "issues" in validated ? validated.issues.join(" ") : "Este cenário não é válido." };
  }

  const updated = await db
    .update(drills)
    .set({ title, scene: validated.data, kind: validated.data.kind, updatedAt: new Date() })
    .where(and(eq(drills.id, id), eq(drills.ownerId, user.id)))
    .returning({ id: drills.id });

  if (updated.length === 0) return { ok: false, error: "Este exercício não é teu para editar." };

  revalidatePath("/drills");
  return { ok: true, savedAt: Date.now() };
}

export async function deleteDrill(formData: FormData) {
  const user = await requireCoach();
  const id = String(formData.get("id"));

  await db.delete(drills).where(and(eq(drills.id, id), eq(drills.ownerId, user.id)));

  revalidatePath("/drills");
  redirect("/drills");
}

export async function duplicateDrill(formData: FormData) {
  const user = await requireCoach();
  const id = String(formData.get("id"));

  const [source] = await db
    .select()
    .from(drills)
    .where(and(eq(drills.id, id), eq(drills.ownerId, user.id)))
    .limit(1);
  if (!source) redirect("/drills");

  const [copy] = await db
    .insert(drills)
    .values({
      ownerId: user.id,
      kind: source.kind,
      typeId: source.typeId,
      title: `${source.title} (cópia)`,
      description: source.description,
      tags: source.tags,
      scene: source.scene,
      shareId: nanoid(12),
    })
    .returning({ id: drills.id });

  revalidatePath("/drills");
  redirect(`/drills/${copy.id}`);
}
