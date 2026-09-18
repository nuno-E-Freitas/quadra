import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { ResetForm } from "@/components/reset-form";
import { resetIsValid } from "@/lib/auth/reset";
import styles from "@/app/(auth)/auth.module.css";

export const metadata: Metadata = {
  title: "Repor palavra-passe · Quadra",
  robots: { index: false, follow: false },
};

/**
 * Deliberately outside the (auth) group: that layout sends anyone with a
 * session to /drills, and someone resetting a password may well still be
 * signed in on this device.
 */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const live = await resetIsValid(token);

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <Wordmark size={1.15} />
        {live ? (
          <ResetForm token={token} />
        ) : (
          <>
            <p className={styles.tagline}>
              Este link já foi usado ou expirou. Pede outro a quem te criou a conta.
            </p>
            <Link className="btn" href="/login">
              Entrar
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
