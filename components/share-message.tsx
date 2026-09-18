"use client";

import { useState } from "react";
import styles from "@/app/(app)/app.module.css";

/**
 * The whole message, not just the link.
 *
 * This product does not compete with other tactics boards; it competes with the
 * squad's group chat. Every week the coach was copying a URL and typing the rest
 * around it by hand — so hand over the paragraph, ready to paste.
 */
export function ShareMessage({
  title,
  link,
  scheduledFor,
  description,
}: {
  title: string;
  link: string;
  scheduledFor: string | null;
  description: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const lines = [
    `📋 ${title}`,
    scheduledFor ? `🗓️ ${scheduledFor}` : null,
    description ? description : null,
    "",
    link,
    "",
    "Diz se vens no link acima.",
  ].filter((line) => line !== null);

  const message = lines.join("\n");

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.meta}>Mensagem para o grupo</span>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            font: "inherit",
            fontSize: "0.86rem",
            color: "var(--ink-2)",
            margin: 0,
          }}
        >
          {message}
        </pre>
      </div>
      <button
        className="btn btn-primary"
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "✓ Copiado" : "Copiar mensagem"}
      </button>
    </div>
  );
}
