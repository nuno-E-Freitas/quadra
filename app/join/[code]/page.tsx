import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { invites, memberships, teams } from "@/db/schema";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth/session";
import { acceptInvite } from "@/lib/teams/actions";
import styles from "@/app/(auth)/auth.module.css";

export const metadata: Metadata = {
  title: "Entrar numa equipa · Quadra",
  robots: { index: false, follow: false },
};

/**
 * Deliberately a GET that only *offers* to join: a prefetch of this link must
 * not enrol anyone, so the membership is written by the button's POST.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [invite] = await db
    .select({ teamId: invites.teamId, role: invites.role, team: teams.name })
    .from(invites)
    .innerJoin(teams, eq(teams.id, invites.teamId))
    .where(and(eq(invites.code, code), gt(invites.expiresAt, new Date())))
    .limit(1);

  const user = await getCurrentUser();

  const already =
    invite && user
      ? await db
          .select({ role: memberships.role })
          .from(memberships)
          .where(and(eq(memberships.teamId, invite.teamId), eq(memberships.userId, user.id)))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <Wordmark size={1.15} />

        {!invite ? (
          <>
            <p className={styles.tagline}>
              Este link de adesão expirou ou foi revogado. Pede um novo ao teu treinador.
            </p>
            <Link className="btn" href="/login">
              Entrar
            </Link>
          </>
        ) : already ? (
          <>
            <p className={styles.tagline}>
              Já estás em <b>{invite.team}</b>, como {already.role === "coach" ? "treinador" : "jogador"}.
            </p>
            <Link className="btn btn-primary" href={already.role === "coach" ? "/drills" : "/feed"}>
              Ir para os teus treinos
            </Link>
          </>
        ) : user ? (
          <>
            <p className={styles.tagline}>
              Foste convidado para entrar em <b>{invite.team}</b> como{" "}
              {invite.role === "coach" ? "treinador" : "jogador"}.
            </p>
            <form action={acceptInvite}>
              <input type="hidden" name="code" value={code} />
              <button className="btn btn-primary" type="submit">
                Entrar em {invite.team}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className={styles.tagline}>
              O <b>{invite.team}</b> convidou-te para veres os treinos e as jogadas. Cria uma conta para
              entrares — é rápido e fica tudo no mesmo sítio.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href={`/signup?invite=${code}`}>
                Criar conta
              </Link>
              <Link className="btn" href={`/login?invite=${code}`}>
                Já tenho conta
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
