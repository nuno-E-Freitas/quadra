export function Wordmark({ size = 1 }: { size?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-display), sans-serif",
        fontWeight: 800,
        fontSize: `${1.15 * size}rem`,
        letterSpacing: "-0.03em",
        color: "var(--ink)",
      }}
    >
      <svg width={26 * size} height={15 * size} viewBox="0 0 40 20" aria-hidden="true">
        <rect width="40" height="20" rx="1.5" fill="var(--court)" />
        <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="0.9">
          <line x1="20" y1="0" x2="20" y2="20" />
          <circle cx="20" cy="10" r="3.4" />
          <path d="M 0 3 A 6.4 6.4 0 0 1 6.4 9.4 L 6.4 10.6 A 6.4 6.4 0 0 1 0 17" />
          <path d="M 40 3 A 6.4 6.4 0 0 0 33.6 9.4 L 33.6 10.6 A 6.4 6.4 0 0 0 40 17" />
        </g>
      </svg>
      Quadra
    </span>
  );
}
