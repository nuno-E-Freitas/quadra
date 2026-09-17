import type { Metadata } from "next";
import Link from "next/link";
import { requireCoach } from "@/lib/auth/session";
import { createTraining } from "@/lib/trainings/actions";
import { getMyTrainings } from "@/lib/trainings/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Treinos · Quadra" };

export default async function TrainingsPage() {
  const user = await requireCoach();
  const rows = await getMyTrainings(user.id);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Treinos</span>
          <h1>Sessões que a equipa abre com um só link</h1>
        </div>
        <form action={createTraining} className={styles.inline}>
          <input name="title" placeholder="Sessão de terça" maxLength={120} aria-label="Título do treino" />
          <button className="btn btn-primary" type="submit">
            Novo treino
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>Ainda não há treinos montados</b>
          <p>
            Um treino é uma lista ordenada de jogadas e exercícios com um só link. Em vez de mandares
            oito links para o grupo, mandas um.
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
                    ? row.scheduledFor.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
                    : "sem data"}
                </span>
              </div>
              <Link className="btn" href={`/t/${row.shareId}`}>
                Abrir link
              </Link>
              <Link className="btn btn-primary" href={`/trainings/${row.id}`}>
                Editar
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
