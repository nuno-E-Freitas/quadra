"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, login, signup } from "@/lib/auth/actions";
import styles from "@/app/(auth)/auth.module.css";

const initial: AuthState = { error: null };

export function AuthForm({ mode, invite }: { mode: "login" | "signup"; invite?: string }) {
  const isSignup = mode === "signup";
  const [state, formAction, pending] = useActionState(isSignup ? signup : login, initial);

  return (
    <>
      <form className={styles.card} action={formAction}>
        <h1>{isSignup ? "Create your account" : "Sign in"}</h1>

        {state.error ? (
          <p className="alert" role="alert">
            {state.error}
          </p>
        ) : null}

        {invite ? <input type="hidden" name="invite" value={invite} /> : null}

        {isSignup ? (
          <div className="field">
            <label htmlFor="name">Name</label>
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
          <label htmlFor="password">Password</label>
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
          {pending ? "One moment…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className={styles.alt}>
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href={invite ? `/login?invite=${invite}` : "/login"}>Sign in</Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href={invite ? `/signup?invite=${invite}` : "/signup"}>Create one</Link>
          </>
        )}
      </p>
    </>
  );
}
