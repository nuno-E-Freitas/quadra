import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
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

export const metadata: Metadata = { title: "Training · Quadra" };

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
          <span className="eyebrow">Training</span>
          <h1>{training.title}</h1>
        </div>
        <form action={deleteTraining}>
          <input type="hidden" name="id" value={training.id} />
          <button className="btn" type="submit">
            Delete
          </button>
        </form>
      </div>

      <section className={styles.section}>
        <h2>The link you send</h2>
        <div className={styles.row}>
          <span className={styles.code + " " + styles.rowMain}>{link}</span>
          <Link className="btn" href={"/t/" + training.shareId}>
            Open
          </Link>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Details</h2>
        <form action={updateTraining} className={styles.rows}>
          <input type="hidden" name="id" value={training.id} />
          <div className={styles.row}>
            <div className={styles.inline + " " + styles.rowMain}>
              <input
                name="title"
                defaultValue={training.title}
                maxLength={120}
                aria-label="Title"
                style={{ flex: 1 }}
              />
              <input
                type="date"
                name="scheduledFor"
                defaultValue={isoDate(training.scheduledFor)}
                aria-label="Date"
              />
              <select name="teamId" defaultValue={training.teamId ?? ""} aria-label="Squad">
                <option value="">no squad</option>
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
              placeholder="What this session is for"
              maxLength={2000}
              aria-label="Description"
              className={styles.rowMain}
              style={inputStyle}
            />
            <button className="btn btn-primary" type="submit">
              Save details
            </button>
          </div>
        </form>
      </section>

      <section className={styles.section}>
        <h2>
          Running order <span className={styles.meta}>({items.length})</span>
        </h2>

        {items.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Empty. Add a play or a drill below — the order here is the order the squad sees.
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
                      placeholder="What to say about this one"
                      maxLength={500}
                      aria-label={"Note for " + item.title}
                      style={{ flex: 1, minWidth: 160 }}
                    />
                    <button className="btn" type="submit">
                      Note
                    </button>
                  </form>
                </div>
                <div className={styles.rowActions}>
                  <form action={moveItem}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="btn" type="submit" disabled={i === 0} aria-label="Move up">
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
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </form>
                  <form action={removeDrillFromTraining}>
                    <input type="hidden" name="id" value={training.id} />
                    <input type="hidden" name="drillId" value={item.drillId} />
                    <button className="btn" type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Add from your library</h2>
        {addable.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Everything you have is already in this training.
          </p>
        ) : (
          <div className={styles.rows}>
            {addable.map((drill) => (
              <div key={drill.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <b>{drill.title}</b>
                  <span className={styles.meta}>{drill.kind}</span>
                </div>
                <form action={addDrillToTraining}>
                  <input type="hidden" name="id" value={training.id} />
                  <input type="hidden" name="drillId" value={drill.id} />
                  <button className="btn" type="submit">
                    Add
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 28 }}>
        <Link href="/trainings" className={styles.meta}>
          ← All trainings
        </Link>
      </p>
    </>
  );
}
