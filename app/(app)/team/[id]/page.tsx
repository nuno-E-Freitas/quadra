import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
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
import { getQuartets, getQuartetByUser } from "@/lib/teams/quartets";
import {
  assignToQuartet,
  createQuartet,
  deleteQuartet,
  renameQuartet,
} from "@/lib/teams/quartet-actions";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Equipa · Quadra" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeamCoach(id);
  const { team, roster, invites } = await getTeamDetail(id);
  const [base, blocks, blockOf] = await Promise.all([
    siteOrigin(),
    getQuartets(id),
    getQuartetByUser(id),
  ]);

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
        <h2>Quartetos</h2>
        <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginBottom: 12 }}>
          Futsal joga-se em blocos que rodam. Cria-os aqui e escolhe o de cada jogador na lista
          abaixo — cada um pertence a um só, que é o que a rotação quer dizer.
        </p>

        <form action={createQuartet} className={styles.inline} style={{ marginBottom: 12 }}>
          <input type="hidden" name="teamId" value={team.id} />
          <input name="name" placeholder="Quarteto A" required maxLength={30} aria-label="Nome do quarteto" />
          <button className="btn btn-primary" type="submit">
            Criar quarteto
          </button>
        </form>

        {blocks.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            Ainda não há nenhum. Sem eles a equipa é uma lista; com eles é uma rotação.
          </p>
        ) : (
          <div className={styles.rows}>
            {blocks.map((block) => (
              <div key={block.id} className={styles.row}>
                <form action={renameQuartet} className={styles.inline}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <input type="hidden" name="id" value={block.id} />
                  <input
                    name="name"
                    defaultValue={block.name}
                    maxLength={30}
                    aria-label={"Nome de " + block.name}
                    style={{ minWidth: 140 }}
                  />
                  <button className="btn" type="submit">
                    Mudar nome
                  </button>
                </form>

                <div className={styles.rowMain}>
                  <span className={styles.meta}>
                    {block.members.length === 0
                      ? "ninguém ainda"
                      : block.members.map((m) => m.name).join(", ")}
                  </span>
                </div>

                <form action={deleteQuartet}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <input type="hidden" name="id" value={block.id} />
                  <ConfirmButton
                    message={`Apagar "${block.name}"? Os jogadores ficam sem quarteto; ninguém sai da equipa.`}
                  >
                    Apagar
                  </ConfirmButton>
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
                  {blocks.length > 0 && member.role === "player" ? (
                    <form action={assignToQuartet} className={styles.inline}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="userId" value={member.userId} />
                      <select
                        name="quartetId"
                        defaultValue={blockOf.get(member.userId)?.id ?? ""}
                        aria-label={"Quarteto de " + member.name}
                      >
                        <option value="">sem quarteto</option>
                        {blocks.map((block) => (
                          <option key={block.id} value={block.id}>
                            {block.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn" type="submit">
                        Definir
                      </button>
                    </form>
                  ) : null}

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
