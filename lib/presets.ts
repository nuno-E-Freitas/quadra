import type { PitchMark, PitchOverlay, Scene, SceneKind, Vec } from "./scene";

export const COLORS = {
  home: "#2bb8a3",
  away: "#e8604f",
  violet: "#9b8cf5",
  amber: "#f0b429",
  blue: "#5aa9f0",
  chalk: "#f2f5f4",
  ball: "#ffffff",
  cone: "#dfe6e4",
} as const;

export const PALETTE = [COLORS.home, COLORS.away, COLORS.violet, COLORS.amber, COLORS.blue, COLORS.chalk];

type Seed = { id: string; kind: Scene["tokens"][number]["kind"]; side: Scene["tokens"][number]["side"]; label: string; color: string; at: Vec };

const PLAY_SEED: Seed[] = [
  { id: "h1", kind: "player", side: "home", label: "1", color: COLORS.home, at: { x: 4, y: 10 } },
  { id: "h2", kind: "player", side: "home", label: "2", color: COLORS.home, at: { x: 19, y: 10 } },
  { id: "h3", kind: "player", side: "home", label: "3", color: COLORS.home, at: { x: 26, y: 17 } },
  { id: "h4", kind: "player", side: "home", label: "4", color: COLORS.home, at: { x: 26, y: 3 } },
  { id: "h5", kind: "player", side: "home", label: "5", color: COLORS.home, at: { x: 33, y: 10 } },
  { id: "a1", kind: "player", side: "away", label: "1", color: COLORS.away, at: { x: 37.4, y: 10 } },
  { id: "a2", kind: "player", side: "away", label: "4", color: COLORS.away, at: { x: 30.6, y: 10.9 } },
  { id: "a3", kind: "player", side: "away", label: "2", color: COLORS.away, at: { x: 29, y: 5 } },
  { id: "a4", kind: "player", side: "away", label: "3", color: COLORS.away, at: { x: 29, y: 15 } },
  { id: "a5", kind: "player", side: "away", label: "5", color: COLORS.away, at: { x: 23, y: 10 } },
  { id: "ball", kind: "ball", side: "neutral", label: "", color: COLORS.ball, at: { x: 27.1, y: 3.9 } },
];

const TRAINING_SEED: Seed[] = [
  { id: "c1", kind: "cone", side: "neutral", label: "", color: COLORS.cone, at: { x: 12, y: 3 } },
  { id: "c2", kind: "cone", side: "neutral", label: "", color: COLORS.cone, at: { x: 30, y: 3 } },
  { id: "c3", kind: "cone", side: "neutral", label: "", color: COLORS.cone, at: { x: 30, y: 17 } },
  { id: "c4", kind: "cone", side: "neutral", label: "", color: COLORS.cone, at: { x: 12, y: 17 } },
  { id: "pA1", kind: "player", side: "home", label: "A", color: COLORS.home, at: { x: 13, y: 4 } },
  { id: "pA2", kind: "player", side: "home", label: "A", color: COLORS.home, at: { x: 11.4, y: 2.9 } },
  { id: "pB1", kind: "player", side: "away", label: "B", color: COLORS.away, at: { x: 29, y: 4 } },
  { id: "pB2", kind: "player", side: "away", label: "B", color: COLORS.away, at: { x: 30.6, y: 2.9 } },
  { id: "pC1", kind: "player", side: "neutral", label: "C", color: COLORS.violet, at: { x: 29, y: 16 } },
  { id: "pC2", kind: "player", side: "neutral", label: "C", color: COLORS.violet, at: { x: 30.6, y: 17.1 } },
  { id: "pD1", kind: "player", side: "neutral", label: "D", color: COLORS.amber, at: { x: 13, y: 16 } },
  { id: "pD2", kind: "player", side: "neutral", label: "D", color: COLORS.amber, at: { x: 11.4, y: 17.1 } },
  { id: "ball", kind: "ball", side: "neutral", label: "", color: COLORS.ball, at: { x: 13.9, y: 4.7 } },
];

/** Everything about how a court looks, as opposed to what stands on it. */
export type PitchLook = {
  surface: string;
  lines: string;
  surround: string;
  overlays: PitchOverlay[];
  marks: PitchMark[];
};

/** The court as it has always looked. A coach's saved preference overrides it. */
export const DEFAULT_PITCH: PitchLook = {
  surface: "#1b3a37",
  lines: "#ffffff",
  surround: "#17302e",
  overlays: [],
  marks: [],
};

/** Ready-made courts, so nobody has to find three colours that work together. */
export const PITCH_PRESETS: ({ name: string } & Omit<PitchLook, "overlays" | "marks">)[] = [
  { name: "Quadra", surface: "#1b3a37", lines: "#ffffff", surround: "#17302e" },
  { name: "Pavilhão", surface: "#2f4f7a", lines: "#ffffff", surround: "#1d3352" },
  { name: "Madeira", surface: "#c08a4e", lines: "#ffffff", surround: "#8a5f33" },
  { name: "Terra batida", surface: "#b4573a", lines: "#f4e9e2", surround: "#7e3b28" },
  { name: "Quadro preto", surface: "#14171a", lines: "#7fe3b0", surround: "#0b0d0f" },
  { name: "Papel", surface: "#f2efe6", lines: "#2b3a38", surround: "#ddd8c9" },
];

/** A fresh scene is one setup step and nothing else — steps[0] never has moves. */
export function newScene(kind: SceneKind, pitch: Partial<PitchLook> = {}): Scene {
  const seed = kind === "play" ? PLAY_SEED : TRAINING_SEED;
  const positions: Record<string, Vec> = {};
  for (const s of seed) positions[s.id] = { ...s.at };

  return {
    schemaVersion: 1,
    kind,
    pitch: { width: 40, height: 20, variant: "full", ...DEFAULT_PITCH, ...pitch },
    tokens: seed.map(({ id, kind: k, side, label, color }) => ({ id, kind: k, side, label, color })),
    steps: [{ id: "setup", durationMs: 1000, moves: [], positions }],
    attachments: {},
  };
}

export const DEFAULT_TITLE = { play: "Jogada sem nome", training: "Exercício sem nome" } as const;
