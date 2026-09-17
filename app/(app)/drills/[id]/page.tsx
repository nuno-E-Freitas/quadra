import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { Editor } from "@/components/board/editor";
import { ConfirmButton } from "@/components/confirm-button";
import { PublishPanel } from "@/components/publish-panel";
import { requireCoach } from "@/lib/auth/session";
import { siteOrigin } from "@/lib/origin";
import { getDrillPublications, getMyTeams } from "@/lib/teams/queries";
import { deleteDrill } from "@/lib/drills/actions";
import { setDrillType } from "@/lib/drills/type-actions";
import { listDrillTypes } from "@/lib/drills/types";
import styles from "../../app.module.css";
import { sceneSchema } from "@/lib/scene";

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCoach();

  const [row] = await db
    .select({
      id: drills.id,
      title: drills.title,
      shareId: drills.shareId,
      scene: drills.scene,
      typeId: drills.typeId,
    })
    .from(drills)
    .where(and(eq(drills.id, id), eq(drills.ownerId, user.id)))
    .limit(1);

  if (!row) notFound();

  // The column is JSONB written by an older version of this app as easily as the
  // current one — parse on the way out, do not trust the shape.
  const scene = sceneSchema.safeParse(row.scene);
  if (!scene.success) notFound();

  const [teams, published, types, origin] = await Promise.all([
    getMyTeams(user.id),
    getDrillPublications(row.id),
    listDrillTypes(user.id),
    siteOrigin(),
  ]);

  // Keyed by id so moving between drills remounts the editor with a clean store.
  return (
    <>
      <Editor
        key={row.id}
        drill={{
          id: row.id,
          title: row.title,
          shareId: row.shareId,
          shareUrl: origin + "/b/" + row.shareId,
          scene: scene.data,
        }}
      />
      {/* Set once and then left alone: it has no business competing with the
          board for attention while a coach is drawing. */}
      <details className={styles.sheet}>
        <summary>Ficha da jogada — tipo, publicar, apagar</summary>

        <section className={styles.section}>
        <h2>Tipo de jogada</h2>
        <form action={setDrillType} className={styles.inline}>
          <input type="hidden" name="drillId" value={row.id} />
          <select name="typeId" defaultValue={row.typeId ?? ""} aria-label="Tipo de jogada">
            <option value="">sem tipo</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <button className="btn" type="submit">
            Guardar tipo
          </button>
          <Link href="/settings" className={styles.meta}>
            Gerir tipos →
          </Link>
        </form>
      </section>
      <PublishPanel
        drillId={row.id}
        teams={teams.filter((t) => t.role === "coach").map((t) => ({ id: t.id, name: t.name }))}
        publishedTo={published.map((p) => p.teamId)}
      />

      <section className={styles.section}>
        <h2>Apagar</h2>
        <div className={styles.row}>
          <div className={styles.rowMain}>
            <b>{row.title}</b>
            <span className={styles.meta}>
              Sai das equipas onde está publicada e dos treinos que a listam, e o link de partilha
              deixa de funcionar. Não há como voltar atrás.
            </span>
          </div>
          <form action={deleteDrill}>
            <input type="hidden" name="id" value={row.id} />
            <ConfirmButton message={`Apagar "${row.title}"? Não há como voltar atrás.`}>
              Apagar
            </ConfirmButton>
          </form>
        </div>
        </section>
      </details>
    </>
  );
}
