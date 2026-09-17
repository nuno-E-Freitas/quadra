"use server";

import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/lib/db-errors";
import { invites, memberships, users } from "@/db/schema";
import { MAX_PASSWORD_BYTES, hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export type AuthState = { error: string | null; notice?: string | null };

const email = z
  .email("Isto não parece um endereço de email.")
  .max(254)
  .transform((v) => v.trim().toLowerCase());

const password = z
  .string()
  .min(8, "Usa pelo menos 8 caracteres.")
  .max(MAX_PASSWORD_BYTES, `Não passes dos ${MAX_PASSWORD_BYTES} caracteres.`);

const signupSchema = z.object({
  name: z.string().trim().min(1, "Diz-nos como te chamar.").max(60),
  email,
  password,
});

const loginSchema = z.object({ email, password: z.string().min(1, "Escreve a tua palavra-passe.") });

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifica o formulário e tenta de novo." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // An account born from an invite takes its standing from that invite: a squad
  // being handed a join link gets players, not fifteen new coaches with their
  // own empty libraries. A bare signup is still someone starting a squad.
  const code = String(formData.get("invite") ?? "").trim();
  const invite = code ? await findInvite(code) : null;

  let userId: string;
  try {
    userId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: invite?.role === "player" ? "player" : "coach",
          /**
           * Every account arrives switched off. Registration stays open — anyone
           * may ask for an account — but asking is not the same as having one,
           * and an admin decides which requests become people who can sign in.
           */
          disabledAt: new Date(),
        })
        .returning({ id: users.id });

      if (invite) {
        await tx
          .insert(memberships)
          .values({ teamId: invite.teamId, userId: created.id, role: invite.role })
          .onConflictDoNothing();
      }
      return created.id;
    });
  } catch (err) {
    if (isUniqueViolation(err, "users_email_key")) {
      return { error: "Esse email já tem conta. Experimenta entrar." };
    }
    throw err;
  }

  // Deliberately no session. The account exists but is refused at the session
  // check, so signing them in here would hand them a live cookie that bounces
  // them straight back to the login page with no explanation.
  void userId;
  return {
    error: null,
    notice:
      "Conta criada. Falta um administrador ativá-la — depois disso entras com este email e palavra-passe.",
  };
}

function findInvite(code: string) {
  return db
    .select({ teamId: invites.teamId, role: invites.role })
    .from(invites)
    .where(and(eq(invites.code, code), gt(invites.expiresAt, new Date())))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifica o formulário e tenta de novo." };
  }

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      role: users.role,
      disabledAt: users.disabledAt,
    })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  // Always run a comparison so a missing account and a wrong password take the
  // same time — otherwise the response time tells an attacker who has an account.
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv",
  );
  if (!user || !ok) return { error: "Email ou palavra-passe errados." };
  // Checked only after the password, so the message cannot be used to find out
  // which addresses hold inactive accounts. It covers both a new account waiting
  // for approval and one an admin has switched off — from here they are the
  // same thing, and the database does not distinguish them either.
  if (user.disabledAt) {
    return { error: "Esta conta ainda não está ativa. Fala com um administrador." };
  }

  await createSession(user.id);

  const code = String(formData.get("invite") ?? "").trim();
  if (code) redirect(`/join/${code}`);
  redirect(user.role === "player" ? "/feed" : "/drills");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
