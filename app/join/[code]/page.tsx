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
  title: "Join a squad · Quadra",
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
              This join link has expired or was revoked. Ask your coach for a new one.
            </p>
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </>
        ) : already ? (
          <>
            <p className={styles.tagline}>
              You are already in <b>{invite.team}</b>, as {already.role}.
            </p>
            <Link className="btn btn-primary" href={already.role === "coach" ? "/drills" : "/feed"}>
              Go to your trainings
            </Link>
          </>
        ) : user ? (
          <>
            <p className={styles.tagline}>
              You have been invited to join <b>{invite.team}</b> as {invite.role}.
            </p>
            <form action={acceptInvite}>
              <input type="hidden" name="code" value={code} />
              <button className="btn btn-primary" type="submit">
                Join {invite.team}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className={styles.tagline}>
              <b>{invite.team}</b> invited you to see their trainings and plays. Create an account to
              join — it takes a moment and you keep everything in one place.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href={`/signup?invite=${code}`}>
                Create account
              </Link>
              <Link className="btn" href={`/login?invite=${code}`}>
                I already have one
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
