import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./auth.module.css";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/drills");

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <Wordmark size={1.15} />
        <p className={styles.tagline}>
          A futsal tactics board that remembers the movement — draw a play, send a link.
        </p>
        {children}
      </div>
    </main>
  );
}
