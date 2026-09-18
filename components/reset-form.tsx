"use client";

import Link from "next/link";
import { useActionState } from "react";
import { usePasswordReset, type PasswordState } from "@/lib/auth/passwords";
import styles from "@/app/(auth)/auth.module.css";

const initial: PasswordState = { error: null };

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(usePasswordReset, initial);

  if (state.done) {
    return (
      <>
        <p className={styles.tagline}>Palavra-passe definida. Já podes entrar com ela.</p>
        <Link className="btn btn-primary" href="/login">
          Entrar
        </Link>
      </>
    );
  }

  return (
    <form className={styles.card} action={formAction}>
      <h1>Nova palavra-passe</h1>
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="next">Palavra-passe</label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          autoFocus
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Um momento…" : "Definir"}
      </button>
    </form>
  );
}
