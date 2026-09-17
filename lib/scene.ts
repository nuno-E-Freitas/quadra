import { z } from "zod";

/**
 * The one contract in the app: the editor, the server actions and the `scene`
 * JSONB column all agree on this schema. Coordinates are METRES on a 40 x 20 m
 * futsal pitch, origin top-left — resolution independent, and real distances
 * stay meaningful.
 */

export const PITCH = { width: 40, height: 20 } as const;

export const vecSchema = z.object({
  x: z.number().min(-4).max(44),
  y: z.number().min(-4).max(24),
});

export const tokenKinds = ["player", "ball", "cone", "goal", "marker"] as const;
export const sides = ["home", "away", "neutral"] as const;
export const moveKinds = ["run", "dribble", "pass", "shot", "screen"] as const;

export const tokenSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(tokenKinds),
  side: z.enum(sides),
  label: z.string().max(3),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a #rrggbb colour"),
});

export const moveSchema = z.object({
  tokenId: z.string().min(1),
  kind: z.enum(moveKinds),
  /** Captured from the drag, then simplified with Ramer–Douglas–Peucker. */
  points: z.array(vecSchema).min(2).max(200),
});

export const stepSchema = z.object({
  id: z.string().min(1),
  durationMs: z.number().int().min(200).max(20_000),
  moves: z.array(moveSchema).max(40),
  /**
   * Resting position of every token at the END of the step. Redundant with
   * `moves` on purpose: it makes rendering any step instant without replaying
   * history, and it survives a move being deleted.
   */
  positions: z.record(z.string(), vecSchema),
  note: z.string().max(280).optional(),
});

/** Six-digit hex, because that is what <input type="color"> emits. */
const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.");

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.enum(["play", "training"]),
  pitch: z.object({
    width: z.literal(40),
    height: z.literal(20),
    variant: z.enum(["full", "half", "grid"]).default("full"),
    /**
     * Defaults reproduce the original court exactly, and `.default()` fills them
     * in on the way out — so every scene written before these existed keeps
     * rendering unchanged without a data migration.
     */
    surface: hexColour.default("#1b3a37"),
    lines: hexColour.default("#ffffff"),
    surround: hexColour.default("#17302e"),
  }),
  tokens: z.array(tokenSchema).min(1).max(24),
  /** steps[0] is the setup: positions only, no moves. */
  steps: z.array(stepSchema).min(1).max(40),
  /** ballId -> carrierId. While attached, the ball follows its carrier. */
  attachments: z.record(z.string(), z.string()).optional(),
});

export type Vec = z.infer<typeof vecSchema>;
export type Token = z.infer<typeof tokenSchema>;
export type Move = z.infer<typeof moveSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type MoveKind = (typeof moveKinds)[number];
export type SceneKind = Scene["kind"];

/**
 * "Play" and "training" are two validation profiles over one structure, not two
 * features. A play locks to 5 v 5 with one ball; a training is freer.
 */
export const PROFILES = {
  play: {
    label: "Jogada",
    caption: "5 x 5 · fixo",
    maxPlayers: 10,
    playersPerSide: 5,
    maxBalls: 1,
    allowsProps: false,
    freeColours: false,
  },
  training: {
    label: "Treino",
    caption: "até 20 jogadores",
    maxPlayers: 20,
    playersPerSide: null,
    maxBalls: 4,
    allowsProps: true,
    freeColours: true,
  },
} as const;

/** Schema validity plus the profile rules. Use this at every write boundary. */
export function validateScene(input: unknown) {
  const parsed = sceneSchema.safeParse(input);
  if (!parsed.success) return parsed;

  const scene = parsed.data;
  const profile = PROFILES[scene.kind];
  const issues: string[] = [];

  const players = scene.tokens.filter((t) => t.kind === "player");
  const balls = scene.tokens.filter((t) => t.kind === "ball");

  if (players.length > profile.maxPlayers) {
    issues.push(`${profile.label}: no máximo ${profile.maxPlayers} jogadores.`);
  }
  if (balls.length > profile.maxBalls) {
    issues.push(`${profile.label}: no máximo ${profile.maxBalls} bola(s).`);
  }
  if (profile.playersPerSide !== null) {
    for (const side of ["home", "away"] as const) {
      const n = players.filter((t) => t.side === side).length;
      if (n > profile.playersPerSide) {
        issues.push(`Uma jogada permite ${profile.playersPerSide} jogadores por equipa; ${side} tem ${n}.`);
      }
    }
  }
  if (!profile.allowsProps && scene.tokens.some((t) => t.kind === "cone" || t.kind === "goal")) {
    issues.push("Cones e balizas pertencem a um treino, não a uma jogada.");
  }

  const ids = new Set(scene.tokens.map((t) => t.id));
  if (ids.size !== scene.tokens.length) issues.push("Os ids das peças têm de ser únicos.");
  for (const step of scene.steps) {
    for (const move of step.moves) {
      if (!ids.has(move.tokenId)) issues.push(`O passo ${step.id} move uma peça desconhecida: ${move.tokenId}.`);
    }
  }

  return issues.length
    ? ({ success: false as const, error: new Error(issues.join(" ")), issues })
    : ({ success: true as const, data: scene });
}

/**
 * How close the ball has to be to count as at a player's feet, in metres. The
 * player mark is 0.85 m across and the ball 0.46, so they touch at about 1.3 —
 * this leaves a little room for a coach who placed the ball roughly.
 */
export const CARRY_RADIUS_M = 1.5;

/**
 * Who is carrying a given ball right now.
 *
 * An explicit attachment always wins: a coach who picked a carrier in the panel
 * means it, even if someone else drifts closer. Otherwise it is inferred from
 * distance, and only the *nearest* player takes it — with two players standing
 * over a loose ball, both carrying it would make moving either one drag the ball
 * away from the other.
 */
export function carrierOf(
  scene: Scene,
  positions: Record<string, Vec>,
  ballId: string,
): string | null {
  const explicit = scene.attachments?.[ballId];
  if (explicit) return positions[explicit] ? explicit : null;

  const ball = positions[ballId];
  if (!ball) return null;

  let best: string | null = null;
  let bestDistance = CARRY_RADIUS_M;
  for (const token of scene.tokens) {
    if (token.kind !== "player") continue;
    const at = positions[token.id];
    if (!at) continue;
    const distance = Math.hypot(at.x - ball.x, at.y - ball.y);
    if (distance <= bestDistance) {
      best = token.id;
      bestDistance = distance;
    }
  }
  return best;
}

/** Every ball this player is carrying, in the order the scene lists them. */
export function ballsCarriedBy(
  scene: Scene,
  positions: Record<string, Vec>,
  playerId: string,
): string[] {
  return scene.tokens
    .filter((t) => t.kind === "ball" && carrierOf(scene, positions, t.id) === playerId)
    .map((t) => t.id);
}
