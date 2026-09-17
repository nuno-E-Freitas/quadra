import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getFeed } from "@/lib/teams/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Os meus treinos · Quadra" };

/** The player's home. Everything a coach has published to a squad they are in. */
export default async function FeedPage() {
  const user = await requireUser();
  const rows = await getFeed(user.id);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Para ti</span>
          <h1>Os teus treinos e jogadas</h1>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>Ainda não há nada publicado</b>
          <p>
            Quando o teu treinador publicar uma jogada ou um treino para a tua equipa, aparece aqui.
            Toca numa para veres para onde vais tu e para onde vai a bola.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((row) => {
            const steps = Math.max(0, (row.scene?.steps?.length ?? 1) - 1);
            return (
              <Link key={row.id} href={`/b/${row.shareId}`} className={styles.card}>
                <span className={styles.meta}>
                  {row.teamName} · {row.kind === "play" ? "jogada" : "treino"} · {steps} passo
                  {steps === 1 ? "" : "s"}
                </span>
                <b>{row.title}</b>
                <span className={styles.meta}>
                  {row.publishedAt.toLocaleDateString("pt-PT", {
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
