import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";

export const hashResetToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/**
 * Whether a link is still worth showing a form for. A plain query rather than a
 * server action: exporting it as one would make "is this token live?" callable
 * from anywhere with any token.
 */
export async function resetIsValid(token: string) {
  const [row] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.id, hashResetToken(token)),
        gt(passwordResets.expiresAt, new Date()),
        isNull(passwordResets.usedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}
