"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_TITLE, newScene } from "@/lib/presets";
import { validateScene, type SceneKind } from "@/lib/scene";

export type SaveResult = { ok: true; savedAt: number } | { ok: false; error: string };

export async function createDrill(formData: FormData) {
  const user = await requireUser();
  const kind = (formData.get("kind") === "training" ? "training" : "play") as SceneKind;

  const [created] = await db
    .insert(drills)
    .values({
      ownerId: user.id,
      kind,
      title: DEFAULT_TITLE[kind],
      scene: newScene(kind),
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
  const user = await requireUser();

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
  const user = await requireUser();
  const id = String(formData.get("id"));

  await db.delete(drills).where(and(eq(drills.id, id), eq(drills.ownerId, user.id)));

  revalidatePath("/drills");
  redirect("/drills");
}

export async function duplicateDrill(formData: FormData) {
  const user = await requireUser();
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
      title: `${source.title} (copy)`,
      description: source.description,
      tags: source.tags,
      scene: source.scene,
      shareId: nanoid(12),
    })
    .returning({ id: drills.id });

  revalidatePath("/drills");
  redirect(`/drills/${copy.id}`);
}
