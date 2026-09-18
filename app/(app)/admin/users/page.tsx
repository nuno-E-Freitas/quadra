import type { Metadata } from "next";
import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { drills, teams, users, USER_ROLES } from "@/db/schema";
import { ConfirmButton } from "@/components/confirm-button";
import { ResetLink } from "@/components/reset-link";
import { siteOrigin } from "@/lib/origin";
import { requireAdmin } from "@/lib/auth/session";
import { deleteUser, setUserDisabled, setUserRole } from "@/lib/admin/actions";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Contas · Quadra" };

/** Names what actually goes, from the real counts — a vague warning teaches
 *  people to click through warnings. */
function removalWarning(name: string, drills: number, teams: number) {
  const losses = [
    drills + (drills === 1 ? " exercício" : " exercícios"),
    teams + (teams === 1 ? " equipa que criou" : " equipas que criou"),
    "os treinos e os tipos de jogada",
  ].join(", ");

  return (
    "Remover " +
    name +
    " definitivamente? Leva consigo " +
    losses +
    (teams > 0 ? ", e com as equipas a inscrição de todos os outros jogadores" : "") +
    ". Não há como voltar atrás — para lhe tirar o acesso sem destruir nada, usa Desativar."
  );
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const origin = await siteOrigin();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      disabledAt: users.disabledAt,
      createdAt: users.createdAt,
      drills: count(drills.id),
      teams: sql<number>`(select count(*)::int from ${teams} where ${teams.ownerId} = ${users.id})`,
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
                  <button
                    className={row.disabledAt ? "btn btn-primary" : "btn"}
                    type="submit"
                    disabled={self}
                  >
                    {row.disabledAt ? "Ativar" : "Desativar"}
                  </button>
                </form>

                {self ? null : <ResetLink userId={row.id} name={row.name} origin={origin} />}

                {self ? null : (
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={row.id} />
                    <ConfirmButton message={removalWarning(row.name, row.drills, row.teams)}>
                      Remover
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={styles.meta} style={{ marginTop: 20, textTransform: "none", letterSpacing: 0 }}>
        Contas novas chegam desativadas: qualquer pessoa pode pedir conta em /signup, mas é aqui que
        se decide quem passa a poder entrar. <b>Repor palavra-passe</b> gera um link de uso único,
        válido dois dias, para dares a quem não consegue entrar — não há email nesta aplicação, por
        isso o link passa por ti. Desativar tira o acesso e guarda tudo; Remover apaga a
        pessoa e o trabalho dela, incluindo as equipas que criou. Não podes mudar o teu próprio
        papel, desativar-te nem remover-te — é isso que impede o último administrador de trancar
        toda a gente fora.
      </p>
    </>
  );
}
