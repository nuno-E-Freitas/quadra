import { curvePath } from "@/lib/geometry";
import type { PitchOverlay, Scene } from "@/lib/scene";

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
  const { variant, surface, lines, surround, overlays, marks } = pitch;

  return (
    <g>
      <rect x="-2.4" y="-2.4" width="44.8" height="24.8" fill={surround} />
      <rect x="0" y="0" width="40" height="20" fill={surface} />

      {/* Under the futsal lines, the way they are under your feet in a pavilion. */}
      {overlays.map((name) => (
        <CourtOverlay key={name} name={name} />
      ))}

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

      {/* Above the printed lines so it reads as something added to the floor,
          still below the players so it never hides one. */}
      {marks.map((mark) => (
        <path
          key={mark.id}
          d={curvePath(mark.points)}
          fill="none"
          stroke={mark.color}
          strokeOpacity="0.72"
          strokeWidth="0.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

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

/**
 * Each sport gets the colour it usually wears on a pavilion floor, faint enough
 * to stay underneath the futsal lines and the players. Distinct colours rather
 * than one grey, because the point is to say "the blue arc", not "that line".
 */
const OVERLAY_COLOUR: Record<PitchOverlay, string> = {
  andebol: "#f0b429",
  basquetebol: "#5aa9f0",
  voleibol: "#e8604f",
};

export const OVERLAY_LABEL: Record<PitchOverlay, string> = {
  andebol: "Andebol",
  basquetebol: "Basquetebol",
  voleibol: "Voleibol",
};

function CourtOverlay({ name }: { name: PitchOverlay }) {
  const common = {
    fill: "none",
    stroke: OVERLAY_COLOUR[name],
    strokeOpacity: 0.34,
    strokeWidth: 0.13,
  } as const;

  if (name === "andebol") {
    /**
     * A handball court is 40 x 20 — the same floor — so only the marks futsal
     * lacks are worth drawing. The 9 m arcs start where they cross the
     * sideline: r=9 from a post at y=8.5 meets y=0 at x=sqrt(81-72.25)=2.96.
     */
    return (
      <g {...common}>
        <path d="M 2.96 0 A 9 9 0 0 1 9 8.5 L 9 11.5 A 9 9 0 0 1 2.96 20" strokeDasharray="0.6 0.4" />
        <path d="M 37.04 0 A 9 9 0 0 0 31 8.5 L 31 11.5 A 9 9 0 0 0 37.04 20" strokeDasharray="0.6 0.4" />
        {/* 7 m penalty line and the 4 m goalkeeper restraining tick. */}
        <line x1="7" y1="9.5" x2="7" y2="10.5" />
        <line x1="33" y1="9.5" x2="33" y2="10.5" />
        <line x1="4" y1="9.85" x2="4" y2="10.15" />
        <line x1="36" y1="9.85" x2="36" y2="10.15" />
      </g>
    );
  }

  if (name === "basquetebol") {
    /**
     * 28 x 15 centred on the futsal court, so x runs 6..34 and y 2.5..17.5.
     * The basket sits 1.575 m in from the baseline; the three-point arc is
     * r=6.75 from it, meeting the 0.9 m corner lines at x=8.99.
     */
    return (
      <g {...common}>
        <rect x="6" y="2.5" width="28" height="15" />
        <line x1="20" y1="2.5" x2="20" y2="17.5" />
        <circle cx="20" cy="10" r="1.8" />

        <path d="M 6 3.4 L 8.99 3.4 A 6.75 6.75 0 0 1 8.99 16.6 L 6 16.6" />
        <path d="M 34 3.4 L 31.01 3.4 A 6.75 6.75 0 0 0 31.01 16.6 L 34 16.6" />

        <rect x="6" y="7.55" width="5.8" height="4.9" />
        <rect x="28.2" y="7.55" width="5.8" height="4.9" />
        <circle cx="11.8" cy="10" r="1.8" />
        <circle cx="28.2" cy="10" r="1.8" />
      </g>
    );
  }

  /** Volleyball: 18 x 9 centred, attack lines 3 m either side of the net. */
  return (
    <g {...common}>
      <rect x="11" y="5.5" width="18" height="9" />
      <line x1="20" y1="5.5" x2="20" y2="14.5" />
      <line x1="17" y1="5.5" x2="17" y2="14.5" />
      <line x1="23" y1="5.5" x2="23" y2="14.5" />
    </g>
  );
}
