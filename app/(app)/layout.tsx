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
              <Link href="/drills">Biblioteca</Link>
              <Link href="/trainings">Treinos</Link>
              <Link href="/team">Equipas</Link>
            </>
          ) : null}
          <Link href="/feed">{coach ? "Vista do jogador" : "Os meus treinos"}</Link>
          {user.role === "admin" ? <Link href="/admin/users">Contas</Link> : null}
        </nav>

        <div className={styles.right}>
          <span className={styles.who} title={`${user.email} · ${user.role}`}>
            {user.name}
          </span>
          <form action={logout}>
            <button className="btn" type="submit">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
