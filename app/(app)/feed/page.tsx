import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getFeed } from "@/lib/teams/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "My trainings · Quadra" };

/** The player's home. Everything a coach has published to a squad they are in. */
export default async function FeedPage() {
  const user = await requireUser();
  const rows = await getFeed(user.id);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">For you</span>
          <h1>Your trainings and plays</h1>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>Nothing published yet</b>
          <p>
            When your coach publishes a play or a training to your squad, it appears here. Tap one to
            watch where you go and where the ball goes.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((row) => {
            const steps = Math.max(0, (row.scene?.steps?.length ?? 1) - 1);
            return (
              <Link key={row.id} href={`/b/${row.shareId}`} className={styles.card}>
                <span className={styles.meta}>
                  {row.teamName} · {row.kind} · {steps} step{steps === 1 ? "" : "s"}
                </span>
                <b>{row.title}</b>
                <span className={styles.meta}>
                  {row.publishedAt.toLocaleDateString(undefined, {
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
