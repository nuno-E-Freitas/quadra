import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  createInvite,
  removeMember,
  renameTeam,
  revokeInvite,
  setMemberNumber,
  setMemberRole,
} from "@/lib/teams/actions";
import { getTeamDetail, requireTeamCoach } from "@/lib/teams/queries";
import styles from "../../app.module.css";

export const metadata: Metadata = { title: "Squad · Quadra" };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeamCoach(id);
  const { team, roster, invites } = await getTeamDetail(id);
  const base = await origin();

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Squad</span>
          <h1>{team.name}</h1>
        </div>
        <form action={renameTeam} className={styles.inline}>
          <input type="hidden" name="teamId" value={team.id} />
          <input name="name" defaultValue={team.name} maxLength={80} aria-label="Squad name" />
          <button className="btn" type="submit">
            Rename
          </button>
        </form>
      </div>

      <section className={styles.section}>
        <h2>Join links</h2>
        <p className={styles.meta} style={{ marginBottom: 10, textTransform: "none", letterSpacing: 0 }}>
          One link, reusable for 14 days — paste it in the squad&apos;s group chat. A player who signs up
          through it joins as a player, with no library of their own.
        </p>

        <form action={createInvite} className={styles.inline} style={{ marginBottom: 12 }}>
          <input type="hidden" name="teamId" value={team.id} />
          <select name="role" defaultValue="player" aria-label="Invite as">
            <option value="player">as player</option>
            <option value="coach">as coach</option>
          </select>
          <button className="btn btn-primary" type="submit">
            New join link
          </button>
        </form>

        {invites.length === 0 ? (
          <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0 }}>
            No live invite. Make one when you are ready to add people.
          </p>
        ) : (
          <div className={styles.rows}>
            {invites.map((invite) => (
              <div key={invite.code} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.code}>{`${base}/join/${invite.code}`}</span>
                  <span className={styles.meta}>
                    {invite.role} · expires{" "}
                    {invite.expiresAt.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="code" value={invite.code} />
                  <button className="btn" type="submit">
                    Revoke
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>
          Squad list <span className={styles.meta}>({roster.length})</span>
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

                {member.disabledAt ? <span className={styles.pill}>disabled</span> : null}
                <span className={`${styles.pill} ${member.role === "coach" ? styles.pillOn : ""}`}>
                  {isOwner ? "owner" : member.role}
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
                      aria-label={`Shirt number for ${member.name}`}
                    />
                    <button className="btn" type="submit">
                      Set
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
                          Make {member.role === "coach" ? "player" : "coach"}
                        </button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <button className="btn" type="submit">
                          Remove
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
          ← All squads
        </Link>
      </p>
    </>
  );
}
