import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { requireCoach } from "@/lib/auth/session";
import { getMyTeams } from "@/lib/teams/queries";
import {
  addDrillToTraining,
  deleteTraining,
  moveItem,
  removeDrillFromTraining,
  setItemNote,
  updateTraining,
} from "@/lib/trainings/actions";
import {
  getAddableDrills,
  getTraining,
  getTrainingItems,
  requireOwnedTraining,
} from "@/lib/trainings/queries";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Treino · Quadra" };

const inputStyle = {
  font: "inherit",
  padding: "7px 10px",
  border: "1px solid var(--line-2)",
  borderRadius: 7,
  background: "var(--surface)",
  color: "var(--ink)",
} as const;

function isoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCoach();
  await requireOwnedTraining(id);

  const [training, items, addable, teams, h] = await Promise.all([
    getTraining(id),
    getTrainingItems(id),
    getAddableDrills(user.id, id),
    getMyTeams(user.id),
    headers(),
  ]);

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = proto + "://" + host + "/t/" + training.shareId;
  const coached = teams.filter((t) => t.role === "coach");

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Treino</span>
          <h1>{training.title}</h1>
        </div>
        <form action={deleteTraining}>
          <input type="hidden" name="id" value={training.id} />
          <ConfirmButton
            message={`Apagar o treino "${training.title}"? As jogadas não se perdem, mas o link deixa de funcionar.`}
          >
            Apagar
          </ConfirmButton>
        </form>
      </div>

      <section className={styles.section}>
        <h2>O link que envias</h2>
        <div className={styles.row}>
          <span className={styles.code + " " + styles.rowMain}>{link}</span>
          <Link className="btn" href={"/t/" + training.shareId}>
            Abrir
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Detalhes</h2>
        <form action={updateTraining} className={styles.rows}>
          <input type="hidden" name="id" value={training.id} />
          <div className={styles.row}>
            <div className={styles.inline + " " + styles.rowMain}>
              <input
                name="title"
                defaultValue={training.title}
                maxLength={120}
                aria-label="Título"
                style={{ flex: 1 }}
              />
              <input
                type="date"
                name="scheduledFor"
                defaultValue={isoDate(training.scheduledFor)}
                aria-label="Data"
              />
              <select name="teamId" defaultValue={training.teamId ?? ""} aria-label="Equipa">
                <option value="">sem equipa</option>
                {coached.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.row}>
            <input
              name="description"
              defaultValue={training.description ?? ""}
              placeholder="Para que serve esta sessão"
              maxLength={2000}
              aria-label="Descrição"
              className={styles.rowMain}
              style={inputStyle}
            />
            <button className="btn btn-primary" type="submit">
              Guardar detalhes
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2>
          Ordem de trabalhos <span className={styles.meta}>({items.length})</span>
        </h2>

        {items.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Vazio. Junta uma jogada ou um exercício abaixo — esta ordem é a que a equipa vê.
          </p>
        ) : (
          <div className={styles.rows}>
            {items.map((item, i) => (
              <div key={item.drillId} className={styles.row}>
                <span className={styles.pill}>{i + 1}</span>
                <div className={styles.rowMain}>
                  <b>{item.title}</b>
                  <form action={setItemNote} className={styles.inline}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <input
                      name="note"
                      defaultValue={item.note ?? ""}
                      placeholder="O que dizer sobre este"
                      maxLength={500}
                      aria-label={"Nota para " + item.title}
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    <button className="btn" type="submit">
                      Nota
                    </button>
                  </form>
                </div>
                <div className={styles.rowActions}>
                  <form action={moveItem}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="btn" type="submit" disabled={i === 0} aria-label="Subir">
                      ↑
                    </button>
                  </form>
                  <form action={moveItem}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <input type="hidden" name="direction" value="down" />
                    <button
                      className="btn"
                      type="submit"
                      disabled={i === items.length - 1}
                      aria-label="Descer"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={removeDrillFromTraining}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <button className="btn" type="submit">
                      Remover
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Juntar da tua biblioteca</h2>
        {addable.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Já tens tudo o que possuis dentro deste treino.
          </p>
        ) : (
          <div className={styles.rows}>
            {addable.map((drill) => (
              <div key={drill.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <b>{drill.title}</b>
                  <span className={styles.meta}>{drill.kind === "play" ? "jogada" : "treino"}</span>
                </div>
                <form action={addDrillToTraining}>
                  <input type="hidden" name="id" value={training.id} />
                  <input type="hidden" name="drillId" value={drill.id} />
                  <button className="btn" type="submit">
                    Juntar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 28 }}>
        <Link href="/trainings" className={styles.meta}>
          ← Todos os treinos
        </Link>
      </p>
    </>
  );
}
