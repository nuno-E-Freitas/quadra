"use client";

import { useActionState, useState } from "react";
import { createPasswordReset } from "@/lib/auth/passwords";
import styles from "@/app/(app)/app.module.css";

const initial = { link: null as string | null, error: null as string | null };

/**
 * There is no email in this app, so a password nobody remembers is recovered
 * the way everything else here is: an administrator hands over a link. Shown
 * once, in the page rather than through a redirect, so the token never travels
 * in a URL bar or a server log.
 */
export function ResetLink({ userId, name, origin }: { userId: string; name: string; origin: string }) {
  const [state, formAction, pending] = useActionState(createPasswordReset, initial);
  const [copied, setCopied] = useState(false);

  if (state.link) {
    const full = origin + state.link;
    return (
      <div className={styles.inline}>
        <code className={styles.code}>{full}</code>
        <button
          className="btn"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(full);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
        <span className={styles.meta}>válido 2 dias, uma única vez</span>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      {state.error ? <span className={styles.meta}>{state.error}</span> : null}
      <button className="btn" type="submit" disabled={pending} title={"Gerar um link para " + name}>
        {pending ? "A gerar…" : "Repor palavra-passe"}
      </button>
    </form>
  );
}
