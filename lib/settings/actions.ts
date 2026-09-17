"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { PITCH_OVERLAYS, pitchMarkSchema } from "@/lib/scene";
import { getPreferences } from "./queries";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const lookSchema = z.object({
  surface: hexColour,
  lines: hexColour,
  surround: hexColour,
  overlays: z.array(z.enum(PITCH_OVERLAYS)).max(3),
  marks: z.array(pitchMarkSchema).max(30),
});

export async function savePitchPreference(formData: FormData) {
  const user = await requireCoach();

  const parsed = lookSchema.omit({ marks: true }).safeParse({
    surface: formData.get("surface"),
    lines: formData.get("lines"),
    surround: formData.get("surround"),
    // Checkboxes: absent entirely when none is ticked.
    overlays: formData.getAll("overlays").map(String),
  });
  if (!parsed.success) redirect("/settings");

  // Merged rather than replaced, twice over: this column will hold more than the
  // court, and the hand-drawn lines are not in this form — saving a colour must
  // not rub them out.
  const current = await getPreferences(user.id);
  await db
    .update(users)
    .set({
      preferences: { ...current, pitch: { ...(current.pitch ?? {}), ...parsed.data } },
    })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  redirect("/settings");
}

/**
 * Take the court a coach has just built in the editor — colours, pavilion lines
 * and whatever they drew on it — and make it the one every new play starts from.
 * Drawing is something you do on a board, so this is where the board hands the
 * result over, rather than asking them to draw it a second time inside Settings.
 */
export async function savePitchAsDefault(look: unknown) {
  const user = await requireCoach();

  const parsed = lookSchema.safeParse(look);
  if (!parsed.success) return { ok: false as const, error: "Esse campo não é válido." };

  const current = await getPreferences(user.id);
  await db
    .update(users)
    .set({ preferences: { ...current, pitch: parsed.data } })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { ok: true as const };
}

export async function clearDefaultPitchMarks() {
  const user = await requireCoach();
  const current = await getPreferences(user.id);

  await db
    .update(users)
    .set({ preferences: { ...current, pitch: { ...(current.pitch ?? {}), marks: [] } } })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  redirect("/settings");
}

/**
 * Drops the stored court rather than writing the defaults in, so a coach who
 * resets keeps following the app's default if it ever changes.
 */
export async function resetPitchPreference() {
  const user = await requireCoach();
  const current = await getPreferences(user.id);
  delete current.pitch;

  await db.update(users).set({ preferences: current }).where(eq(users.id, user.id));

  revalidatePath("/settings");
  redirect("/settings");
}
