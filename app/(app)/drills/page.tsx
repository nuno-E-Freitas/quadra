import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { drillTypes, drills } from "@/db/schema";
import { requireCoach } from "@/lib/auth/session";
import { listDrillTypes } from "@/lib/drills/types";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Biblioteca · Quadra" };

/** "none" is a real filter, not the absence of one: untyped plays are the pile
 *  a coach most wants to find and classify. */
const UNTYPED = "none";

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const user = await requireCoach();
  const { tipo } = await searchParams;

  const types = await listDrillTypes(user.id);
  const active = tipo && (tipo === UNTYPED || types.some((t) => t.id === tipo)) ? tipo : null;

  const filter =
    active === UNTYPED
      ? and(eq(drills.ownerId, user.id), isNull(drills.typeId))
      : active
        ? and(eq(drills.ownerId, user.id), eq(drills.typeId, active))
        : eq(drills.ownerId, user.id);

  const [rows, counts] = await Promise.all([
    db
      .select({
        id: drills.id,
        title: drills.title,
        kind: drills.kind,
        scene: drills.scene,
        updatedAt: drills.updatedAt,
        typeName: drillTypes.name,
      })
      .from(drills)
      .leftJoin(drillTypes, eq(drillTypes.id, drills.typeId))
      .where(filter)
      .orderBy(desc(drills.updatedAt))
      .limit(60),
    db
      .select({ typeId: drills.typeId, n: sql<number>`count(*)::int` })
      .from(drills)
      .where(eq(drills.ownerId, user.id))
      .groupBy(drills.typeId),
  ]);

  const countFor = (id: string | null) => counts.find((c) => c.typeId === id)?.n ?? 0;
  const total = counts.reduce((sum, c) => sum + c.n, 0);

  const chip = (href: string, label: string, n: number, on: boolean) => (
    <Link
      key={href}
      href={href}
      className={styles.pill + " " + (on ? styles.pillOn : "")}
      style={{ textDecoration: "none" }}
    >
      {label} {n}
    </Link>
  );

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Biblioteca</span>
          <h1>As tuas jogadas e exercícios</h1>
        </div>
        <Link className="btn btn-primary" href="/drills/new">
          Nova jogada
        </Link>
      </div>



      <section className={styles.section}>
        <div className={styles.inline}>
          {chip("/drills", "Todas", total, !active)}
          {types.map((type) =>
            chip("/drills?tipo=" + type.id, type.name, countFor(type.id), active === type.id),
          )}
          {countFor(null) > 0
            ? chip("/drills?tipo=" + UNTYPED, "Sem tipo", countFor(null), active === UNTYPED)
            : null}
          <Link href="/settings" className={styles.meta} style={{ marginLeft: 6 }}>
            Gerir tipos →
          </Link>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <b>{active ? "Nada neste tipo" : "Ainda não há nada guardado"}</b>
          <p>
            {active
              ? "Nenhuma jogada está classificada assim. Abre uma jogada para lhe dar um tipo."
              : "Começa por uma jogada: escolhes o tipo, dás-lhe um nome, e o quadro abre com a equipa no sítio. Arrasta, e cada movimento deixa o seu trajeto marcado. Depois envia o link à tua equipa."}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map((row) => {
            const steps = Math.max(0, (row.scene?.steps?.length ?? 1) - 1);
            return (
              <Link key={row.id} href={"/drills/" + row.id} className={styles.card}>
                <span className={styles.meta}>
                  {row.typeName ?? (row.kind === "play" ? "jogada" : "treino")} · {steps} passo
                  {steps === 1 ? "" : "s"}
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
