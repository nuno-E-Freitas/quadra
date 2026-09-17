import type { Metadata } from "next";
import Link from "next/link";
import { BoardView } from "@/components/board/board-view";
import { requireCoach } from "@/lib/auth/session";
import { createDrill } from "@/lib/drills/actions";
import { listDrillTypeTemplates } from "@/lib/drills/types";
import { newScene } from "@/lib/presets";
import { sceneSchema } from "@/lib/scene";
import { getPitchDefaults } from "@/lib/settings/queries";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Nova jogada · Quadra" };

/**
 * The type comes first because it decides what the board looks like when it
 * opens. Asking for it afterwards would mean arranging ten pieces and then
 * being told there was a saved arrangement all along.
 */
export default async function NewDrillPage() {
  const user = await requireCoach();
  const [types, pitch] = await Promise.all([
    listDrillTypeTemplates(user.id),
    getPitchDefaults(user.id),
  ]);

  const plain = newScene("play", pitch);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Nova</span>
          <h1>Que tipo de jogada vais fazer?</h1>
        </div>
      </div>

      <form action={createDrill}>
        <div className={styles.grid} style={{ marginBottom: 22 }}>
          {types.map((type) => {
            const parsed = type.template ? sceneSchema.safeParse(type.template) : null;
            const scene = parsed?.success ? parsed.data : null;
            return (
              <label key={type.id} className={styles.card} style={{ cursor: "pointer" }}>
                <span className={styles.inline}>
                  <input type="radio" name="typeId" value={type.id} />
                  <b>{type.name}</b>
                </span>
                {scene ? (
                  <BoardView scene={scene} positions={scene.steps[0].positions} />
                ) : (
                  <BoardView scene={plain} positions={plain.steps[0].positions} />
                )}
                <span className={styles.meta}>
                  {scene ? "posições guardadas" : "sem posições — começa na formação normal"}
                </span>
              </label>
            );
          })}

          <label className={styles.card} style={{ cursor: "pointer" }}>
            <span className={styles.inline}>
              <input type="radio" name="typeId" value="" defaultChecked />
              <b>Sem tipo</b>
            </span>
            <BoardView scene={plain} positions={plain.steps[0].positions} />
            <span className={styles.meta}>classifica-a depois</span>
          </label>
        </div>

        <section className={styles.section} style={{ marginTop: 0 }}>
          <h2>E chama-se…</h2>
          <div className={styles.inline}>
            <input
              name="title"
              placeholder="Saída de 4 pela direita"
              maxLength={120}
              aria-label="Nome da jogada"
              style={{ minWidth: 240 }}
            />
            <button className="btn btn-primary" type="submit" name="kind" value="play">
              Criar jogada
            </button>
            <button className="btn" type="submit" name="kind" value="training">
              Criar exercício
            </button>
          </div>
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginTop: 10 }}>
            As posições guardadas valem para jogadas. Um exercício começa sempre na sua própria
            formação, porque aceita peças que uma jogada não tem.
          </p>
        </section>
      </form>

      <p style={{ marginTop: 28 }}>
        <Link href="/drills" className={styles.meta}>
          ← Biblioteca
        </Link>
      </p>
    </>
  );
}
