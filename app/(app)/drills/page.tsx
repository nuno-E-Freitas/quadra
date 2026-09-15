import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { createDrill } from "@/lib/drills/actions";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Library · Quadra" };

export default async function DrillsPage() {
  const user = await requireUser();

  const rows = await db
    .select({
      id: drills.id,
      title: drills.title,
      kind: drills.kind,
      scene: drills.scene,
      updatedAt: drills.updatedAt,
    })
    .from(drills)
    .where(eq(drills.ownerId, user.id))
    .orderBy(desc(drills.updatedAt))
    .limit(60);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Library</span>
          <h1>Your plays and drills</h1>
        </div>
        <div className={styles.newButtons}>
          <form action={createDrill}>
            <input type="hidden" name="kind" value="play" />
            <button className="btn btn-primary" type="submit">
              New play
            </button>
          </form>
          <form action={createDrill}>
            <input type="hidden" name="kind" value="training" />
            <button className="btn" type="submit">
              New training
            </button>
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>Nothing saved yet</b>
          <p>
            Start with a play: place players on the court, drag them, and every move leaves its path
            behind. Then send the link to your squad.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((row) => {
            const steps = Math.max(0, (row.scene?.steps?.length ?? 1) - 1);
            return (
              <Link key={row.id} href={`/drills/${row.id}`} className={styles.card}>
                <span className={styles.meta}>
                  {row.kind} · {steps} step{steps === 1 ? "" : "s"}
                </span>
                <b>{row.title}</b>
                <span className={styles.meta}>
                  {row.updatedAt.toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
