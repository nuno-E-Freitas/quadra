"use client";

/**
 * A submit button that asks first. Deleting a drill cascades: it disappears from
 * every squad it was published to and from any training that listed it, and the
 * share link a player may already have in their phone stops working. That is a
 * lot to happen from one stray tap on a touchscreen.
 */
export function ConfirmButton({
  children,
  message,
  className = "btn",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
