"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users, USER_ROLES } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";

const role = z.enum(USER_ROLES);

export async function setUserRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const parsed = role.safeParse(formData.get("role"));
  if (!parsed.success) redirect("/admin/users");

  // Refusing self-edits is what stops the last admin demoting themselves and
  // leaving the install with nobody able to hand the role back.
  if (userId === admin.id) redirect("/admin/users");

  await db.update(users).set({ role: parsed.data }).where(eq(users.id, userId));
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function setUserDisabled(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const disable = formData.get("disable") === "1";
  if (userId === admin.id) redirect("/admin/users");

  await db
    .update(users)
    .set({ disabledAt: disable ? new Date() : null })
    .where(eq(users.id, userId));

  // The session check already refuses a disabled account, but dropping the rows
  // means nothing is left to reinstate if the account is turned back on.
  if (disable) await db.delete(sessions).where(eq(sessions.userId, userId));

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
