import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { logout } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import styles from "./app.module.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const coach = user.role === "coach" || user.role === "admin";

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href={coach ? "/drills" : "/feed"} className={styles.brand}>
          <Wordmark />
        </Link>

        <nav className={styles.nav}>
          {coach ? (
            <>
              <Link href="/drills">Library</Link>
              <Link href="/sessions">Trainings</Link>
              <Link href="/team">Squads</Link>
            </>
          ) : null}
          <Link href="/feed">{coach ? "Player view" : "My trainings"}</Link>
          {user.role === "admin" ? <Link href="/admin/users">Accounts</Link> : null}
        </nav>

        <div className={styles.right}>
          <span className={styles.who} title={`${user.email} · ${user.role}`}>
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
