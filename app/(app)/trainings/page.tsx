import type { Metadata } from "next";
import Link from "next/link";
import { requireCoach } from "@/lib/auth/session";
import { createTraining } from "@/lib/trainings/actions";
import { getMyTrainings } from "@/lib/trainings/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Trainings · Quadra" };

export default async function TrainingsPage() {
  const user = await requireCoach();
  const rows = await getMyTrainings(user.id);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Trainings</span>
          <h1>Sessions your squad can open with one link</h1>
        </div>
        <form action={createTraining} className={styles.inline}>
          <input name="title" placeholder="Tuesday session" maxLength={120} aria-label="Training title" />
          <button className="btn btn-primary" type="submit">
            New training
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>No training built yet</b>
          <p>
            A training is an ordered list of plays and drills with one share link. Instead of sending
            eight links to the group chat, you send one.
          </p>
        </div>
      ) : (
        <div className={styles.rows}>
          {rows.map((row) => (
            <div key={row.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>{row.title}</b>
                <span className={styles.meta}>
                  {row.teamName ? `${row.teamName} · ` : ""}
                  {row.scheduledFor
                    ? row.scheduledFor.toLocaleDateString(undefined, { day: "2-digit", month: "short" })
                    : "no date"}
                </span>
              </div>
              <Link className="btn" href={`/t/${row.shareId}`}>
                Open link
              </Link>
              <Link className="btn btn-primary" href={`/trainings/${row.id}`}>
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
