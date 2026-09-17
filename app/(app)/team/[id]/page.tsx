import type { Metadata } from "next";
import Link from "next/link";
import {
  createInvite,
  removeMember,
  renameTeam,
  revokeInvite,
  setMemberNumber,
  setMemberRole,
} from "@/lib/teams/actions";
import { siteOrigin } from "@/lib/origin";
import { getTeamDetail, requireTeamCoach } from "@/lib/teams/queries";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Equipa · Quadra" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeamCoach(id);
  const { team, roster, invites } = await getTeamDetail(id);
  const base = await siteOrigin();

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Equipa</span>
          <h1>{team.name}</h1>
        </div>
        <form action={renameTeam} className={styles.inline}>
          <input type="hidden" name="teamId" value={team.id} />
          <input name="name" defaultValue={team.name} maxLength={80} aria-label="Nome da equipa" />
          <button className="btn" type="submit">
            Mudar nome
          </button>
        </form>
      </div>

      <section className={styles.section}>
        <h2>Links de adesão</h2>
        <p className={styles.meta} style={{ marginBottom: 10, textTransform: "none", letterSpacing: 0 }}>
          Um link, reutilizável durante 14 dias — cola-o no grupo da equipa. Quem criar conta por ele
          entra como jogador, sem biblioteca própria.
        </p>

        <form action={createInvite} className={styles.inline} style={{ marginBottom: 12 }}>
          <input type="hidden" name="teamId" value={team.id} />
          <select name="role" defaultValue="player" aria-label="Convidar como">
            <option value="player">como jogador</option>
            <option value="coach">como treinador</option>
          </select>
          <button className="btn btn-primary" type="submit">
            Novo link de adesão
          </button>
        </form>

        {invites.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Nenhum convite ativo. Cria um quando quiseres juntar pessoas.
          </p>
        ) : (
          <div className={styles.rows}>
            {invites.map((invite) => (
              <div key={invite.code} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.code}>{`${base}/join/${invite.code}`}</span>
                  <span className={styles.meta}>
                    {invite.role === "coach" ? "treinador" : "jogador"} · expira{" "}
                    {invite.expiresAt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="code" value={invite.code} />
                  <button className="btn" type="submit">
                    Revogar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>
          Plantel <span className={styles.meta}>({roster.length})</span>
        </h2>
        <div className={styles.rows}>
          {roster.map((member) => {
            const isOwner = member.userId === team.ownerId;
            return (
              <div key={member.userId} className={styles.row}>
                <div className={styles.rowMain}>
                  <b>
                    {member.number ? `${member.number} · ` : ""}
                    {member.name}
                  </b>
                  <span className={styles.meta}>{member.email}</span>
                </div>

                {member.disabledAt ? <span className={styles.pill}>desativado</span> : null}
                <span className={`${styles.pill} ${member.role === "coach" ? styles.pillOn : ""}`}>
                  {isOwner ? "dono" : member.role === "coach" ? "treinador" : "jogador"}
                </span>

                <div className={styles.rowActions}>
                  <form action={setMemberNumber} className={styles.inline}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="userId" value={member.userId} />
                    <input
                      name="number"
                      defaultValue={member.number ?? ""}
                      placeholder="nº"
                      maxLength={4}
                      size={3}
                      aria-label={`Número de ${member.name}`}
                    />
                    <button className="btn" type="submit">
                      Definir
                    </button>
                  </form>

                  {isOwner ? null : (
                    <>
                      <form action={setMemberRole}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <input
                          type="hidden"
                          name="role"
                          value={member.role === "coach" ? "player" : "coach"}
                        />
                        <button className="btn" type="submit">
                          Tornar {member.role === "coach" ? "jogador" : "treinador"}
                        </button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <button className="btn" type="submit">
                          Remover
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <p style={{ marginTop: 28 }}>
        <Link href="/team" className={styles.meta}>
          ← Todas as equipas
        </Link>
      </p>
    </>
  );
}
