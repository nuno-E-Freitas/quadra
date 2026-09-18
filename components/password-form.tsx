"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changeOwnPassword, type PasswordState } from "@/lib/auth/passwords";
import styles from "@/app/(app)/app.module.css";

const initial: PasswordState = { error: null };

/** Changing it ends every session, including this one — so say so up front. */
export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPassword, initial);

  if (state.done) {
    return (
      <div className={styles.row}>
        <div className={styles.rowMain}>
          <b>Palavra-passe alterada</b>
          <span className={styles.meta}>
            Todas as sessões terminaram, incluindo esta. Entra outra vez com a nova.
          </span>
        </div>
        <Link className="btn btn-primary" href="/login">
          Entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.inline}>
        <div className="field">
          <label htmlFor="current">Atual</label>
          <input id="current" name="current" type="password" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label htmlFor="next">Nova</label>
          <input
            id="next"
            name="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Um momento…" : "Mudar"}
        </button>
      </div>

      <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginTop: 10 }}>
        Mudar a palavra-passe termina a sessão em todos os aparelhos, este incluído — que é o que se
        quer quando se muda porque um telemóvel se perdeu.
      </p>
    </form>
  );
}
