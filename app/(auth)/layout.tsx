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
          Um quadro tático de futsal que se lembra do movimento — desenha uma jogada, envia um link.
        </p>
        {children}
      </div>
    </main>
  );
}
