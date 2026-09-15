import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createTeam } from "@/lib/teams/actions";
import { getMyTeams } from "@/lib/teams/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Squads · Quadra" };

export default async function TeamsPage() {
  const user = await requireUser();
  const teams = await getMyTeams(user.id);
  const canCreate = user.role === "coach" || user.role === "admin";

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Squads</span>
          <h1>Who you coach, who you play for</h1>
        </div>
        {canCreate ? (
          <form action={createTeam} className={styles.inline}>
            <input name="name" placeholder="Squad name" required maxLength={80} aria-label="Squad name" />
            <button className="btn btn-primary" type="submit">
              New squad
            </button>
          </form>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <div className={styles.empty}>
          <b>No squad yet</b>
          <p>
            {canCreate
              ? "Create a squad, then send its join link to your players. Anything you publish to the squad lands in their trainings."
              : "Once a coach sends you a join link, the squad shows up here."}
          </p>
        </div>
      ) : (
        <div className={styles.rows}>
          {teams.map((team) => (
            <div key={team.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>{team.name}</b>
                <span className={styles.meta}>
                  {team.members} member{team.members === 1 ? "" : "s"}
                </span>
              </div>
              <span className={`${styles.pill} ${team.role === "coach" ? styles.pillOn : ""}`}>
                {team.role}
              </span>
              {team.role === "coach" || user.role === "admin" ? (
                <Link className="btn" href={`/team/${team.id}`}>
                  Manage
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
