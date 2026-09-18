"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { MAX_PASSWORD_BYTES, hashPassword, verifyPassword } from "./password";

const DAY = 86_400_000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const newPassword = z
  .string()
  .min(8, "Usa pelo menos 8 caracteres.")
  .max(MAX_PASSWORD_BYTES, `Não passes dos ${MAX_PASSWORD_BYTES} caracteres.`);

export type PasswordState = { error: string | null; done?: boolean };

/**
 * Changing a password ends every other session. Someone who changes it because
 * a phone was lost expects exactly that, and the alternative — the old device
 * staying signed in — is the one outcome nobody wants.
 */
export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser();

  const parsed = z
    .object({ current: z.string().min(1, "Escreve a palavra-passe atual."), next: newPassword })
    .safeParse({ current: formData.get("current"), next: formData.get("next") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifica o formulário." };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
    return { error: "A palavra-passe atual não está certa." };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  return { error: null, done: true };
}

/**
 * Issue a link for someone who cannot get in. Returned rather than emailed —
 * there is no mail in this app, and an administrator who already approves
 * accounts can hand it over in the same conversation.
 */
export async function createPasswordReset(
  _prev: { link: string | null; error: string | null },
  formData: FormData,
): Promise<{ link: string | null; error: string | null }> {
  await requireAdmin();
  const userId = String(formData.get("userId"));

  const [target] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return { link: null, error: "Essa conta já não existe." };

  // Any link issued earlier stops working: two live links for one account is
  // one more than anybody needs.
  await db.delete(passwordResets).where(eq(passwordResets.userId, target.id));

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    id: sha256(token),
    userId: target.id,
    expiresAt: new Date(Date.now() + 2 * DAY),
  });

  revalidatePath("/admin/users");
  return { link: `/repor/${token}`, error: null };
}

export async function usePasswordReset(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const token = String(formData.get("token"));
  const parsed = newPassword.safeParse(formData.get("next"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifica o formulário." };

  const id = sha256(token);
  const [row] = await db
    .select({ userId: passwordResets.userId })
    .from(passwordResets)
    .where(
      and(eq(passwordResets.id, id), gt(passwordResets.expiresAt, new Date()), isNull(passwordResets.usedAt)),
    )
    .limit(1);
  if (!row) return { error: "Este link já foi usado ou expirou. Pede outro." };

  const passwordHash = await hashPassword(parsed.data);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, id));
    // Whoever was signed in before is not necessarily the person setting this.
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
  });

  return { error: null, done: true };
}
