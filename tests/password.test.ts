import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { usePasswordReset } from "@/lib/auth/passwords";

/**
 * Touches the real database, so it needs DATABASE_URL — `pnpm test` passes it.
 * Everything it writes is namespaced to one throwaway account and removed at
 * the end, pass or fail.
 */
const EMAIL = "__pwtest@quadra.test";
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASSA" : "FALHA"}  ${label}` +
      (ok ? "" : `\n         esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}`),
  );
}

const form = (token: string, next: string) => {
  const data = new FormData();
  data.set("token", token);
  data.set("next", next);
  return data;
};

async function seedUser() {
  await db.delete(users).where(eq(users.email, EMAIL));
  const [user] = await db
    .insert(users)
    .values({ email: EMAIL, name: "Teste", passwordHash: await hashPassword("antiga-12345") })
    .returning({ id: users.id });
  return user.id;
}

async function issue(userId: string, expiresAt: Date) {
  const token = randomBytes(24).toString("base64url");
  await db.insert(passwordResets).values({ id: sha256(token), userId, expiresAt });
  return token;
}

async function main() {
  const hour = 3_600_000;

  console.log("\n== um link válido define a palavra-passe ==");
  {
    const userId = await seedUser();
    // A live session that must not survive: whoever was signed in is not
    // necessarily the person setting this password.
    await db.insert(sessions).values({
      id: sha256("sessao-de-teste"),
      userId,
      expiresAt: new Date(Date.now() + hour),
    });

    const token = await issue(userId, new Date(Date.now() + hour));
    const result = await usePasswordReset({ error: null }, form(token, "nova-senha-123"));
    check("aceite", result, { error: null, done: true });

    const [row] = await db.select({ h: users.passwordHash }).from(users).where(eq(users.id, userId));
    check("a nova entra", await verifyPassword("nova-senha-123", row.h), true);
    check("a antiga deixa de entrar", await verifyPassword("antiga-12345", row.h), false);

    const left = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
    check("as sessões abertas caíram", left.length, 0);

    console.log("\n== o mesmo link não serve duas vezes ==");
    const again = await usePasswordReset({ error: null }, form(token, "outra-senha-123"));
    check("recusado", again.done, undefined);
    check("e diz porquê", Boolean(again.error), true);

    const [still] = await db.select({ h: users.passwordHash }).from(users).where(eq(users.id, userId));
    check("a palavra-passe não mudou na segunda tentativa", await verifyPassword("nova-senha-123", still.h), true);
  }

  console.log("\n== um link expirado não serve ==");
  {
    const userId = await seedUser();
    const token = await issue(userId, new Date(Date.now() - hour));
    const result = await usePasswordReset({ error: null }, form(token, "nova-senha-123"));
    check("recusado", result.done, undefined);

    const [row] = await db.select({ h: users.passwordHash }).from(users).where(eq(users.id, userId));
    check("a antiga continua a valer", await verifyPassword("antiga-12345", row.h), true);
  }

  console.log("\n== um token inventado não serve ==");
  {
    await seedUser();
    const result = await usePasswordReset({ error: null }, form("nao-existe", "nova-senha-123"));
    check("recusado", result.done, undefined);
  }

  console.log("\n== uma palavra-passe curta é recusada antes de tudo ==");
  {
    const userId = await seedUser();
    const token = await issue(userId, new Date(Date.now() + hour));
    const result = await usePasswordReset({ error: null }, form(token, "curta"));
    check("recusada", result.done, undefined);

    // And the link must survive, or a typo would burn it.
    const [live] = await db
      .select({ used: passwordResets.usedAt })
      .from(passwordResets)
      .where(eq(passwordResets.id, sha256(token)));
    check("o link não foi gasto", live?.used ?? null, null);
  }
}

main()
  .then(async () => {
    await db.delete(users).where(eq(users.email, EMAIL));
    console.log(failures === 0 ? "\nTUDO PASSA\n" : `\n${failures} FALHA(S)\n`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    await db.delete(users).where(eq(users.email, EMAIL));
    console.error(error);
    process.exit(1);
  });
