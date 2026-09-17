import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills, users, USER_ROLES } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { setUserDisabled, setUserRole } from "@/lib/admin/actions";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Contas · Quadra" };

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      drills: count(drills.id),
    })
    .from(users)
    .leftJoin(drills, eq(drills.ownerId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.createdAt))
    .limit(200);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Contas</h1>
        </div>
        <span className={styles.meta}>{rows.length} no total</span>
      </div>

      <div className={styles.rows}>
        {rows.map((row) => {
          const self = row.id === admin.id;
          return (
            <div key={row.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>
                  {row.name}
                  {self ? " (tu)" : ""}
                </b>
                <span className={styles.meta}>
                  {row.email} · {row.drills} exercício{row.drills === 1 ? "" : "s"} · desde{" "}
                  {row.createdAt.toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {row.disabledAt ? <span className={styles.pill}>desativada</span> : null}

              <div className={styles.rowActions}>
                <form action={setUserRole} className={styles.inline}>
                  <input type="hidden" name="userId" value={row.id} />
                  <select name="role" defaultValue={row.role} disabled={self} aria-label={`Papel de ${row.name}`}>
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button className="btn" type="submit" disabled={self}>
                    Definir papel
                  </button>
                </form>

                <form action={setUserDisabled}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="disable" value={row.disabledAt ? "0" : "1"} />
                  <button className="btn" type="submit" disabled={self}>
                    {row.disabledAt ? "Ativar" : "Desativar"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.meta} style={{ marginTop: 20, textTransform: "none", letterSpacing: 0 }}>
        Não podes mudar o teu próprio papel nem desativar-te — é isso que impede o último administrador
        de trancar toda a gente fora.
      </p>
    </>
  );
}
