import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createTeam } from "@/lib/teams/actions";
import { getMyTeams } from "@/lib/teams/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Equipas · Quadra" };

export default async function TeamsPage() {
  const user = await requireUser();
  const teams = await getMyTeams(user.id);
  const canCreate = user.role === "coach" || user.role === "admin";

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Equipas</span>
          <h1>Quem treinas, por quem jogas</h1>
        </div>
        {canCreate ? (
          <form action={createTeam} className={styles.inline}>
            <input name="name" placeholder="Nome da equipa" required maxLength={80} aria-label="Nome da equipa" />
            <button className="btn btn-primary" type="submit">
              Nova equipa
            </button>
          </form>
        ) : null}
      </div>

      {teams.length === 0 ? (
        <div className={styles.empty}>
          <b>Ainda não há equipa</b>
          <p>
            {canCreate
              ? "Cria uma equipa e envia o link de adesão aos teus jogadores. Tudo o que publicares para a equipa aparece nos treinos deles."
              : "Assim que um treinador te enviar um link de adesão, a equipa aparece aqui."}
          </p>
        </div>
      ) : (
        <div className={styles.rows}>
          {teams.map((team) => (
            <div key={team.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>{team.name}</b>
                <span className={styles.meta}>
                  {team.members} membro{team.members === 1 ? "" : "s"}
                </span>
              </div>
              <span className={`${styles.pill} ${team.role === "coach" ? styles.pillOn : ""}`}>
                {team.role === "coach" ? "treinador" : "jogador"}
              </span>
              {team.role === "coach" || user.role === "admin" ? (
                <Link className="btn" href={`/team/${team.id}`}>
                  Gerir
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
