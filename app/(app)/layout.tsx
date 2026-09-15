import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import styles from "./app.module.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/drills" className={styles.brand}>
          <Wordmark />
        </Link>
        <div className={styles.right}>
          <span className={styles.who} title={user.email}>
            {user.name}
          </span>
          <form action={logout}>
            <button className="btn" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
