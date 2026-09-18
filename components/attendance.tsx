import Link from "next/link";
import { ATTENDANCE, type Attendance } from "@/db/schema";
import { setAttendance } from "@/lib/trainings/attendance-actions";
import { ATTENDANCE_LABEL } from "@/lib/trainings/attendance";
import styles from "@/app/(app)/app.module.css";

/**
 * The three buttons a player taps. Deliberately on the link they already get
 * rather than on a page of its own — an amateur squad will answer a question
 * that is in front of them and ignore one that needs a second tap to find.
 */
export function AttendanceAsk({
  sessionId,
  shareId,
  mine,
  signedIn,
}: {
  sessionId: string;
  shareId: string;
  mine: Attendance | null;
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <b>Vens a este treino?</b>
          <span className={styles.meta}>Entra com a tua conta para responderes.</span>
        </div>
        <Link className="btn btn-primary" href="/login">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <b>Vens a este treino?</b>
        <span className={styles.meta}>
          {mine ? "Respondido — podes mudar." : "O treinador precisa de saber para preparar."}
        </span>
      </div>
      <div className={styles.rowActions}>
        {ATTENDANCE.map((status) => (
          <form key={status} action={setAttendance}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="shareId" value={shareId} />
            <input type="hidden" name="status" value={status} />
            <button className={mine === status ? "btn btn-primary" : "btn"} type="submit">
              {ATTENDANCE_LABEL[status]}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

/** What the coach reads on a Monday night, counts first. */
export function AttendanceList({
  data,
}: {
  data: {
    rows: { userId: string; name: string; number: string | null; status: Attendance | null }[];
    vou: number;
    duvida: number;
    nao: number;
    sem: number;
  };
}) {
  if (data.rows.length === 0) {
    return (
      <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
        Liga o treino a uma equipa para saberes quem vem. Os jogadores respondem no link que lhes
        envias.
      </p>
    );
  }

  return (
    <>
      <div className={styles.inline} style={{ marginBottom: 12 }}>
        <span className={`${styles.pill} ${styles.pillOn}`}>Vou {data.vou}</span>
        <span className={styles.pill}>Dúvida {data.duvida}</span>
        <span className={styles.pill}>Não {data.nao}</span>
        <span className={styles.pill}>Sem resposta {data.sem}</span>
        {data.vou < 8 ? (
          <span className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            {data.vou < 5
              ? "não dá para 4x4"
              : data.vou < 8
                ? "dá para 4x4 sem trocas"
                : ""}
          </span>
        ) : null}
      </div>

      <div className={styles.rows}>
        {data.rows.map((row) => (
          <div key={row.userId} className={styles.row}>
            <div className={styles.rowMain}>
              <b>
                {row.number ? `${row.number} · ` : ""}
                {row.name}
              </b>
            </div>
            <span className={`${styles.pill} ${row.status === "vou" ? styles.pillOn : ""}`}>
              {row.status ? ATTENDANCE_LABEL[row.status] : "sem resposta"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
