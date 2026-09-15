import type { Metadata } from "next";
import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills, users, USER_ROLES } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { setUserDisabled, setUserRole } from "@/lib/admin/actions";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Accounts · Quadra" };

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
          <span className="eyebrow">Admin</span>
          <h1>Accounts</h1>
        </div>
        <span className={styles.meta}>{rows.length} total</span>
      </div>

      <div className={styles.rows}>
        {rows.map((row) => {
          const self = row.id === admin.id;
          return (
            <div key={row.id} className={styles.row}>
              <div className={styles.rowMain}>
                <b>
                  {row.name}
                  {self ? " (you)" : ""}
                </b>
                <span className={styles.meta}>
                  {row.email} · {row.drills} drill{row.drills === 1 ? "" : "s"} · joined{" "}
                  {row.createdAt.toLocaleDateString(undefined, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {row.disabledAt ? <span className={styles.pill}>disabled</span> : null}

              <div className={styles.rowActions}>
                <form action={setUserRole} className={styles.inline}>
                  <input type="hidden" name="userId" value={row.id} />
                  <select name="role" defaultValue={row.role} disabled={self} aria-label={`Role for ${row.name}`}>
                    {USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button className="btn" type="submit" disabled={self}>
                    Set role
                  </button>
                </form>

                <form action={setUserDisabled}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="disable" value={row.disabledAt ? "0" : "1"} />
                  <button className="btn" type="submit" disabled={self}>
                    {row.disabledAt ? "Enable" : "Disable"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.meta} style={{ marginTop: 20, textTransform: "none", letterSpacing: 0 }}>
        You cannot change your own role or disable yourself — that is what keeps the last admin from
        locking everyone out.
      </p>
    </>
  );
}
