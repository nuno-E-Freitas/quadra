import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { createDrill } from "@/lib/drills/actions";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Biblioteca · Quadra" };

export default async function DrillsPage() {
  const user = await requireCoach();

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
          <span className="eyebrow">Biblioteca</span>
          <h1>As tuas jogadas e exercícios</h1>
        </div>
        <div className={styles.newButtons}>
          <form action={createDrill}>
            <input type="hidden" name="kind" value="play" />
            <button className="btn btn-primary" type="submit">
              Nova jogada
            </button>
          </form>
          <form action={createDrill}>
            <input type="hidden" name="kind" value="training" />
            <button className="btn" type="submit">
              Novo exercício
            </button>
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>Ainda não há nada guardado</b>
          <p>
            Começa por uma jogada: coloca os jogadores na quadra, arrasta-os, e cada movimento deixa o
            seu trajeto marcado. Depois envia o link à tua equipa.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((row) => {
            const steps = Math.max(0, (row.scene?.steps?.length ?? 1) - 1);
            return (
              <Link key={row.id} href={`/drills/${row.id}`} className={styles.card}>
                <span className={styles.meta}>
                  {row.kind === "play" ? "jogada" : "treino"} · {steps} passo{steps === 1 ? "" : "s"}
                </span>
                <b>{row.title}</b>
                <span className={styles.meta}>
                  {row.updatedAt.toLocaleDateString("pt-PT", {
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
