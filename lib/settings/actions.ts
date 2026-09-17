"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { getPreferences } from "./queries";

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export async function savePitchPreference(formData: FormData) {
  const user = await requireCoach();

  const parsed = z
    .object({ surface: hexColour, lines: hexColour, surround: hexColour })
    .safeParse({
      surface: formData.get("surface"),
      lines: formData.get("lines"),
      surround: formData.get("surround"),
    });
  if (!parsed.success) redirect("/settings");

  // Merged rather than replaced: this column will hold more than the court.
  const current = await getPreferences(user.id);
  await db
    .update(users)
    .set({ preferences: { ...current, pitch: parsed.data } })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  redirect("/settings");
}

/**
 * Drops the stored colours rather than writing the defaults in, so a coach who
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
