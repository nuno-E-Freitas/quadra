"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, login, signup } from "@/lib/auth/actions";
import styles from "@/app/(auth)/auth.module.css";

const initial: AuthState = { error: null };

export function AuthForm({ mode, invite }: { mode: "login" | "signup"; invite?: string }) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initial);

  // A created account is the end of this page's job: leaving the form up would
  // invite them to submit it again and be told the email is taken.
  if (state.notice) {
    return (
      <>
        <div className={styles.card}>
          <h1>Conta criada</h1>
          <p>{state.notice}</p>
        </div>
        <p className={styles.alt}>
          <Link href="/login">Ir para a entrada</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <form className={styles.card} action={formAction}>
        <h1>{isSignup ? "Criar conta" : "Entrar"}</h1>

        {state.error ? (
          <p className="alert" role="alert">
            {state.error}
          </p>
        ) : null}

        {invite ? <input type="hidden" name="invite" value={invite} /> : null}

        {isSignup ? (
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" name="name" autoComplete="name" required maxLength={60} />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus={!isSignup}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Palavra-passe</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            maxLength={72}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Um momento…" : isSignup ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <p className={styles.alt}>
        {isSignup ? (
          <>
            Já tens conta?{" "}
            <Link href={invite ? `/login?invite=${invite}` : "/login"}>Entrar</Link>
          </>
        ) : (
          <>
            Ainda não tens conta?{" "}
            <Link href={invite ? `/signup?invite=${invite}` : "/signup"}>Cria uma</Link>
          </>
        )}
      </p>
    </>
  );
}
