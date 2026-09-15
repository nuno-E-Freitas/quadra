"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/lib/db-errors";
import { users } from "@/db/schema";
import { MAX_PASSWORD_BYTES, hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export type AuthState = { error: string | null };

const email = z
  .email("That does not look like an email address.")
  .max(254)
  .transform((v) => v.trim().toLowerCase());

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(MAX_PASSWORD_BYTES, `Keep it under ${MAX_PASSWORD_BYTES} characters.`);

const signupSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you.").max(60),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1, "Enter your password.") });

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string;
  try {
    const [created] = await db
      .insert(users)
      .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
      .returning({ id: users.id });
    userId = created.id;
  } catch (err) {
    if (isUniqueViolation(err, "users_email_key")) {
      return { error: "That email already has an account. Try signing in." };
    }
    throw err;
  }

  await createSession(userId);
  redirect("/drills");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Always run a comparison so a missing account and a wrong password take the
  // same time — otherwise the response time tells an attacker who has an account.
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv",
  );
  if (!user || !ok) return { error: "Wrong email or password." };

  await createSession(user.id);
  redirect("/drills");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
