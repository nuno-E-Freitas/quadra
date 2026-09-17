import { BoardView } from "@/components/board/board-view";
import { ConfirmButton } from "@/components/confirm-button";
import { clearTypeTemplate, setTypeTemplateFromDrill } from "@/lib/drills/type-actions";
import { sceneSchema } from "@/lib/scene";
import styles from "@/app/(app)/app.module.css";

/**
 * The starting shape a type carries. Lifted off a play the coach already drew
 * rather than arranged again here: a defence always begins in the same shape,
 * and the board where they built it is the board they know.
 */
export function TypeTemplate({
  typeId,
  typeName,
  template,
  drills,
}: {
  typeId: string;
  typeName: string;
  template: unknown;
  drills: { id: string; title: string; kind: string }[];
}) {
  const parsed = template ? sceneSchema.safeParse(template) : null;
  const scene = parsed?.success ? parsed.data : null;

  return (
    <div className={styles.row} style={{ alignItems: "flex-start" }}>
      <div style={{ width: 150, flexShrink: 0 }}>
        {scene ? (
          <BoardView scene={scene} positions={scene.steps[0].positions} />
        ) : (
          <div
            className={styles.meta}
            style={{
              border: "1px dashed var(--line-2)",
              borderRadius: 7,
              padding: "18px 8px",
              textAlign: "center",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            sem posições
          </div>
        )}
      </div>

      <div className={styles.rowMain}>
        <span className={styles.meta}>Posições iniciais de {typeName}</span>
        {drills.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Cria uma jogada primeiro, arruma as peças como queres, e depois volta aqui para a usar
            como ponto de partida deste tipo.
          </p>
        ) : (
          <form action={setTypeTemplateFromDrill} className={styles.inline}>
            <input type="hidden" name="typeId" value={typeId} />
            <select name="drillId" aria-label={"Posições para " + typeName} defaultValue="">
              <option value="" disabled>
                copiar de…
              </option>
              {drills.map((drill) => (
                <option key={drill.id} value={drill.id}>
                  {drill.title}
                </option>
              ))}
            </select>
            <button className="btn" type="submit">
              Usar estas posições
            </button>
          </form>
        )}
      </div>

      {scene ? (
        <form action={clearTypeTemplate}>
          <input type="hidden" name="typeId" value={typeId} />
          <ConfirmButton
            message={`Tirar as posições iniciais de "${typeName}"? As jogadas já feitas não mudam.`}
          >
            Limpar
          </ConfirmButton>
        </form>
      ) : null}
    </div>
  );
}
