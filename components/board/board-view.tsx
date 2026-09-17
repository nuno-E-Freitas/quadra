"use client";

import { forwardRef, useMemo } from "react";
import { MOVE_STYLE, curvePath, headAt, sample, subPath } from "@/lib/geometry";
import type { Move, Scene, Token, Vec } from "@/lib/scene";
import { PitchBackground } from "./pitch";

export type DrawnMove = { move: Move; progress: number };

type Props = {
  scene: Scene;
  /** Where every token sits right now — editing positions, or a playback frame. */
  positions: Record<string, Vec>;
  /** Traces to draw, each with how far along it has been revealed. */
  moves?: DrawnMove[];
  /** The path being dragged this instant, before it becomes a Move. */
  live?: { points: Vec[]; color: string } | null;
  selectedId?: string | null;
  draggingId?: string | null;
  interactive?: boolean;
  onTokenPointerDown?: (id: string, event: React.PointerEvent<SVGGElement>) => void;
  onBackgroundPointerDown?: () => void;
};

export const BoardView = forwardRef<SVGSVGElement, Props>(function BoardView(
  {
    scene,
    positions,
    moves = [],
    live,
    selectedId = null,
    draggingId = null,
    interactive = false,
    onTokenPointerDown,
    onBackgroundPointerDown,
  },
  ref,
) {
  const byId = useMemo(() => new Map(scene.tokens.map((t) => [t.id, t])), [scene.tokens]);

  return (
    <svg
      ref={ref}
      viewBox="-2.4 -2.4 44.8 24.8"
      role="img"
      aria-label="Futsal court"
      style={{ display: "block", width: "100%", height: "auto", touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onBackgroundPointerDown?.();
      }}
    >
      <PitchBackground pitch={scene.pitch} />

      <g>
        {moves.map((drawn, i) => (
          <Trace key={`${drawn.move.tokenId}-${i}`} drawn={drawn} token={byId.get(drawn.move.tokenId)} />
        ))}
      </g>

      {live && live.points.length > 1 ? (
        <g>
          <path
            d={curvePath(live.points)}
            fill="none"
            stroke={live.color}
            strokeWidth="1.15"
            strokeOpacity="0.15"
            strokeLinecap="round"
          />
          <path
            d={curvePath(live.points)}
            fill="none"
            stroke={live.color}
            strokeWidth="0.26"
            strokeOpacity="0.85"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}

      <g>
        {scene.tokens.map((token) => {
          const at = positions[token.id];
          if (!at) return null;
          return (
            <TokenMark
              key={token.id}
              token={token}
              at={at}
              selected={selectedId === token.id}
              dragging={draggingId === token.id}
              interactive={interactive}
              onPointerDown={onTokenPointerDown}
            />
          );
        })}
      </g>
    </svg>
  );
});

function Trace({ drawn, token }: { drawn: DrawnMove; token?: Token }) {
  const { move, progress } = drawn;
  const style = MOVE_STYLE[move.kind];
  const color = token?.kind === "ball" ? "#ffffff" : (token?.color ?? "#ffffff");

  const sampled = useMemo(() => sample(move.points), [move.points]);
  if (progress <= 0 || sampled.length === 0) return null;

  const length = sampled.length * Math.min(1, progress);
  const d = subPath(sampled, length, style.wavy);
  const complete = progress >= 1;
  const head = headAt(sampled, length);

  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={style.width * 4.2} strokeOpacity="0.13" strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={style.width}
        strokeOpacity="0.92"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={style.dash || undefined}
      />
      {complete && style.head > 0 ? (
        <polygon
          points="0,0 -0.95,0.5 -0.95,-0.5"
          fill={color}
          fillOpacity="0.92"
          transform={`translate(${head.x.toFixed(2)},${head.y.toFixed(2)}) rotate(${head.angle.toFixed(1)}) scale(${style.head})`}
        />
      ) : null}
      {complete && move.kind === "screen" ? (
        <line
          x1="0"
          y1="-0.7"
          x2="0"
          y2="0.7"
          stroke={color}
          strokeWidth="0.26"
          strokeLinecap="round"
          transform={`translate(${head.x.toFixed(2)},${head.y.toFixed(2)}) rotate(${head.angle.toFixed(1)})`}
        />
      ) : null}
    </g>
  );
}

function TokenMark({
  token,
  at,
  selected,
  dragging,
  interactive,
  onPointerDown,
}: {
  token: Token;
  at: Vec;
  selected: boolean;
  dragging: boolean;
  interactive: boolean;
  onPointerDown?: (id: string, event: React.PointerEvent<SVGGElement>) => void;
}) {
  const common = {
    transform: `translate(${at.x.toFixed(2)},${at.y.toFixed(2)})`,
    style: { cursor: interactive ? (dragging ? "grabbing" : "grab") : "default" } as const,
    onPointerDown: interactive ? (e: React.PointerEvent<SVGGElement>) => onPointerDown?.(token.id, e) : undefined,
  };

  if (token.kind === "ball") {
    return (
      <g {...common}>
        <circle r="0.46" fill="#ffffff" stroke="#0d1f1e" strokeWidth="0.13" />
        <circle r="0.17" fill="#0d1f1e" />
        {selected ? <circle r="0.8" fill="none" stroke="#ffffff" strokeWidth="0.14" /> : null}
      </g>
    );
  }

  /**
   * A mark is a reference point — where a rotation starts, where the press is
   * triggered — not an obstacle. A hollow dashed ring reads as "this spot
   * matters" without looking like something a player runs around, which is
   * exactly what the cone's solid triangle is for.
   */
  if (token.kind === "marker") {
    return (
      <g {...common}>
        <circle
          r="0.62"
          fill="none"
          stroke={token.color}
          strokeWidth="0.17"
          strokeDasharray="0.36 0.24"
          strokeLinecap="round"
        />
        {token.label ? (
          <text
            textAnchor="middle"
            y="0.26"
            fontSize="0.72"
            fill={token.color}
            fontWeight={700}
            style={{ pointerEvents: "none", userSelect: "none", fontFamily: "var(--font-sans), sans-serif" }}
          >
            {token.label}
          </text>
        ) : (
          <circle r="0.13" fill={token.color} />
        )}
        {selected ? <circle r="0.95" fill="none" stroke="#ffffff" strokeWidth="0.14" /> : null}
      </g>
    );
  }

  if (token.kind === "cone") {
    return (
      <g {...common}>
        <path
          d="M 0 -0.62 L 0.56 0.44 L -0.56 0.44 Z"
          fill={token.color}
          stroke="#0d1f1e"
          strokeWidth="0.1"
          strokeLinejoin="round"
        />
        {selected ? <circle r="0.85" fill="none" stroke="#ffffff" strokeWidth="0.14" /> : null}
      </g>
    );
  }

  if (token.kind === "goal") {
    return (
      <g {...common}>
        <rect x="-0.2" y="-1.5" width="0.4" height="3" fill={token.color} stroke="#0d1f1e" strokeWidth="0.1" />
        {selected ? <rect x="-0.6" y="-1.9" width="1.2" height="3.8" fill="none" stroke="#ffffff" strokeWidth="0.14" /> : null}
      </g>
    );
  }

  return (
    <g {...common}>
      <circle
        r="0.85"
        fill={token.color}
        stroke={selected ? "#ffffff" : "rgba(13,31,30,.55)"}
        strokeWidth={selected ? "0.22" : "0.1"}
      />
      <text
        textAnchor="middle"
        y="0.33"
        fontSize="0.92"
        fill="#0d1f1e"
        fontWeight={600}
        style={{ pointerEvents: "none", userSelect: "none", fontFamily: "var(--font-sans), sans-serif" }}
      >
        {token.label}
      </text>
    </g>
  );
}
