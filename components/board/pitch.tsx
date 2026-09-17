import type { Scene } from "@/lib/scene";

/**
 * Real futsal geometry, in metres: 40 x 20 pitch, 3 m centre circle, 6 m penalty
 * arcs joined by a 3.16 m line, penalty mark at 6 m, second penalty mark at 10 m,
 * 3 m goals.
 *
 * The three colours come from the scene rather than from CSS variables. Two
 * reasons: a coach can recolour the court per play, and a standalone SVG — which
 * is what the video export rasterises — has no cascade to read variables from.
 */
export function PitchBackground({ pitch }: { pitch: Scene["pitch"] }) {
  const { variant, surface, lines, surround } = pitch;

  return (
    <g>
      <rect x="-2.4" y="-2.4" width="44.8" height="24.8" fill={surround} />
      <rect x="0" y="0" width="40" height="20" fill={surface} />

      {variant === "grid" ? (
        <g stroke={lines} strokeOpacity="0.14" strokeWidth="0.1">
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`v${i}`} x1={5 * (i + 1)} y1="0" x2={5 * (i + 1)} y2="20" />
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={5 * (i + 1)} x2="40" y2={5 * (i + 1)} />
          ))}
        </g>
      ) : null}

      <g fill="none" stroke={lines} strokeOpacity="0.5" strokeWidth="0.16">
        <rect x="0" y="0" width="40" height="20" />
        <line x1="20" y1="0" x2="20" y2="20" />
        <circle cx="20" cy="10" r="3" />
        <path d="M 0 2.42 A 6 6 0 0 1 6 8.42 L 6 11.58 A 6 6 0 0 1 0 17.58" />
        {variant === "half" ? null : (
          <path d="M 40 2.42 A 6 6 0 0 0 34 8.42 L 34 11.58 A 6 6 0 0 0 40 17.58" />
        )}
        <path d="M 0 0.25 A 0.25 0.25 0 0 0 0.25 0" />
        <path d="M 39.75 0 A 0.25 0.25 0 0 0 40 0.25" />
        <path d="M 40 19.75 A 0.25 0.25 0 0 0 39.75 20" />
        <path d="M 0.25 20 A 0.25 0.25 0 0 0 0 19.75" />
      </g>

      <g fill="none" stroke={lines} strokeOpacity="0.78" strokeWidth="0.2">
        <path d="M 0 8.5 L -0.85 8.5 L -0.85 11.5 L 0 11.5" />
        <path d="M 40 8.5 L 40.85 8.5 L 40.85 11.5 L 40 11.5" />
      </g>

      <g fill={lines} fillOpacity="0.62">
        {[
          [6, 10],
          [34, 10],
          [10, 10],
          [30, 10],
          [20, 10],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.13" />
        ))}
      </g>
    </g>
  );
}
