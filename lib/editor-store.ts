"use client";

import { create, useStore } from "zustand";
import { temporal } from "zundo";
import { simplify } from "./geometry";
import { COLORS } from "./presets";
import { ballsCarriedBy, PROFILES, type MoveKind, type Scene, type Token, type Vec } from "./scene";

export type EditorState = {
  scene: Scene;
  stepIndex: number;
  selectedId: string | null;
  tool: MoveKind;
  /** Bumped on every scene change so autosave knows there is something to send. */
  revision: number;
  /**
   * While recording, steps open themselves. It is deliberately not part of the
   * undo history — undo is about the play, not about what you were doing.
   */
  recording: boolean;

  load: (scene: Scene) => void;
  setStep: (index: number) => void;
  select: (id: string | null) => void;
  setTool: (tool: MoveKind) => void;

  moveToken: (id: string, to: Vec) => void;
  recordDrag: (id: string, points: Vec[]) => void;
  clearStepMoves: () => void;

  startRecording: () => void;
  stopRecording: () => void;
  addStep: () => void;
  deleteStep: (index: number) => void;
  setStepNote: (index: number, note: string) => void;
  setStepDuration: (index: number, ms: number) => void;

  addToken: (kind: Token["kind"], side: Token["side"]) => void;
  removeToken: (id: string) => void;
  setTokenColor: (id: string, color: string) => void;
  setTokenLabel: (id: string, label: string) => void;
  attachBall: (ballId: string, carrierId: string | null) => void;
  setPitch: (colours: Partial<Scene["pitch"]>) => void;
  addPitchMark: (points: Vec[], color: string) => void;
  undoPitchMark: () => void;
  clearPitchMarks: () => void;
};

const clone = <T,>(value: T): T => structuredClone(value);

/** The scene schema caps steps at 40; opening one past that would not validate. */
const MAX_STEPS = 40;

/** And the board at 24 pieces, for the same reason. */
const MAX_TOKENS = 24;

/** And hand-drawn court lines at 30. */
const MAX_PITCH_MARKS = 30;

/** Tools that mean the player has the ball. A screen, a pass or a shot does not. */
const CARRYING_TOOLS: MoveKind[] = ["run", "dribble"];

/**
 * Move along whatever the player was standing over. Carriers are read from the
 * positions *before* the move: the question is whether the ball was at his feet
 * when he set off, not where he happens to end up.
 */
function carryAlong(
  scene: Scene,
  source: Scene,
  positions: Record<string, Vec>,
  stepIndex: number,
  playerId: string,
  delta: Vec,
) {
  for (const ballId of ballsCarriedBy(source, positions, playerId)) {
    const ball = positions[ballId];
    if (ball) propagate(scene, stepIndex, ballId, { x: ball.x + delta.x, y: ball.y + delta.y });
  }
}

/** Where a token sits when the given step begins. */
export function startPositions(scene: Scene, stepIndex: number): Record<string, Vec> {
  return scene.steps[Math.max(0, stepIndex - 1)]?.positions ?? scene.steps[0].positions;
}

/**
 * A reposition carries forward through later steps until one of them actually
 * moves that token, so fixing the setup does not strand every later step.
 */
function propagate(scene: Scene, fromIndex: number, tokenId: string, to: Vec) {
  for (let i = fromIndex; i < scene.steps.length; i++) {
    if (i > fromIndex && scene.steps[i].moves.some((m) => m.tokenId === tokenId)) break;
    scene.steps[i].positions[tokenId] = { ...to };
  }
}

function nextTokenId(scene: Scene, prefix: string) {
  let n = 1;
  while (scene.tokens.some((t) => t.id === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export const useEditor = create<EditorState>()(
  temporal(
    (set) => ({
      scene: undefined as unknown as Scene,
      stepIndex: 0,
      selectedId: null,
      tool: "run",
      revision: 0,
      recording: false,

      load: (scene) =>
        set({ scene: clone(scene), stepIndex: 0, selectedId: null, revision: 0, recording: false }),
      setStep: (index) =>
        set((s) => ({
          stepIndex: Math.max(0, Math.min(index, s.scene.steps.length - 1)),
          selectedId: null,
        })),
      select: (id) => set({ selectedId: id }),
      setTool: (tool) => set({ tool }),

      moveToken: (id, to) =>
        set((s) => {
          const scene = clone(s.scene);
          const at = s.scene.steps[s.stepIndex].positions;
          const before = at[id];
          propagate(scene, s.stepIndex, id, to);
          if (before) {
            carryAlong(scene, s.scene, at, s.stepIndex, id, {
              x: to.x - before.x,
              y: to.y - before.y,
            });
          }
          return { scene, revision: s.revision + 1 };
        }),

      recordDrag: (id, points) =>
        set((s) => {
          const scene = clone(s.scene);
          const end = points[points.length - 1];

          // The setup step holds no moves: dragging there just places the token.
          if (s.stepIndex === 0) {
            const at = s.scene.steps[0].positions;
            const before = at[id];
            propagate(scene, 0, id, end);
            if (before) {
              carryAlong(scene, s.scene, at, 0, id, { x: end.x - before.x, y: end.y - before.y });
            }
            return { scene, revision: s.revision + 1 };
          }

          /**
           * Coming back to a token that has already moved in this step is the
           * cue that the next beat has begun — a coach moves each player once
           * per beat — so while recording that opens a step instead of
           * replacing the path. Not recording, it still corrects the path.
           */
          let stepIndex = s.stepIndex;
          const reMoved = scene.steps[stepIndex].moves.some((m) => m.tokenId === id);
          if (s.recording && reMoved && scene.steps.length < MAX_STEPS) {
            scene.steps.push({
              id: `s${Date.now().toString(36)}`,
              durationMs: 1200,
              moves: [],
              positions: clone(scene.steps[stepIndex].positions),
            });
            stepIndex = scene.steps.length - 1;
          }

          const step = scene.steps[stepIndex];
          const simplified = simplify(points, 0.25);
          const move = { tokenId: id, kind: s.tool, points: simplified };
          const existing = step.moves.findIndex((m) => m.tokenId === id);
          if (existing >= 0) step.moves[existing] = move;
          else step.moves.push(move);
          propagate(scene, stepIndex, id, end);

          // A player who sets off with the ball takes it with him. The ball gets
          // the same path shifted by the gap it already had, so it travels beside
          // him instead of snapping under his mark — and its own trace is drawn
          // as a condução, which is what carrying the ball is called.
          if (CARRYING_TOOLS.includes(s.tool)) {
            const at = s.scene.steps[s.stepIndex].positions;

            const origin = at[id] ?? points[0];
            for (const ballId of ballsCarriedBy(s.scene, at, id)) {
              const ball = at[ballId];
              if (!ball) continue;
              const gap = { x: ball.x - origin.x, y: ball.y - origin.y };
              const path = simplified.map((pt) => ({ x: pt.x + gap.x, y: pt.y + gap.y }));
              const ballMove = { tokenId: ballId, kind: "dribble" as const, points: path };
              const existingBall = step.moves.findIndex((m) => m.tokenId === ballId);
              if (existingBall >= 0) step.moves[existingBall] = ballMove;
              else step.moves.push(ballMove);
              propagate(scene, stepIndex, ballId, path[path.length - 1]);
            }
          }

          return { scene, stepIndex, revision: s.revision + 1 };
        }),

      clearStepMoves: () =>
        set((s) => {
          const scene = clone(s.scene);
          const step = scene.steps[s.stepIndex];
          step.moves = [];
          step.positions = clone(startPositions(scene, s.stepIndex));
          return { scene, revision: s.revision + 1 };
        }),

      /**
       * Recording always opens a fresh beat, so the setup you have just arranged
       * is never overwritten by the first drag. If the last step is already
       * empty there is nothing to open — walk into that one instead.
       */
      startRecording: () =>
        set((s) => {
          const scene = clone(s.scene);
          const last = scene.steps[scene.steps.length - 1];
          const needsStep = scene.steps.length === 1 || last.moves.length > 0;

          if (needsStep && scene.steps.length < MAX_STEPS) {
            scene.steps.push({
              id: `s${Date.now().toString(36)}`,
              durationMs: 1200,
              moves: [],
              positions: clone(last.positions),
            });
          }

          return {
            scene,
            stepIndex: scene.steps.length - 1,
            selectedId: null,
            recording: true,
            revision: s.revision + 1,
          };
        }),

      stopRecording: () =>
        set((s) => {
          const scene = clone(s.scene);
          // A beat that was opened and never used would be a pause in the
          // playback that nobody asked for.
          const last = scene.steps[scene.steps.length - 1];
          if (scene.steps.length > 1 && last.moves.length === 0) scene.steps.pop();

          return {
            scene,
            recording: false,
            stepIndex: Math.min(s.stepIndex, scene.steps.length - 1),
            revision: s.revision + 1,
          };
        }),

      addStep: () =>
        set((s) => {
          const scene = clone(s.scene);
          const last = scene.steps[scene.steps.length - 1];
          scene.steps.push({
            id: `s${Date.now().toString(36)}`,
            durationMs: 1200,
            moves: [],
            positions: clone(last.positions),
          });
          return {
            scene,
            stepIndex: scene.steps.length - 1,
            selectedId: null,
            revision: s.revision + 1,
          };
        }),

      deleteStep: (index) =>
        set((s) => {
          if (index === 0 || s.scene.steps.length <= 1) return s;
          const scene = clone(s.scene);
          scene.steps.splice(index, 1);
          return {
            scene,
            stepIndex: Math.min(s.stepIndex, scene.steps.length - 1),
            revision: s.revision + 1,
          };
        }),

      setStepNote: (index, note) =>
        set((s) => {
          const scene = clone(s.scene);
          scene.steps[index].note = note || undefined;
          return { scene, revision: s.revision + 1 };
        }),

      setStepDuration: (index, ms) =>
        set((s) => {
          const scene = clone(s.scene);
          scene.steps[index].durationMs = Math.max(200, Math.min(20_000, Math.round(ms)));
          return { scene, revision: s.revision + 1 };
        }),

      addToken: (kind, side) =>
        set((s) => {
          const scene = clone(s.scene);
          const profile = PROFILES[scene.kind];
          // The scene schema caps the board at 24 pieces; without this the
          // twenty-fifth is accepted here and then refused by autosave, which
          // reads as the editor losing work.
          if (scene.tokens.length >= MAX_TOKENS) return s;
          if (kind === "player" && scene.tokens.filter((t) => t.kind === "player").length >= profile.maxPlayers) {
            return s;
          }
          if (kind === "ball" && scene.tokens.filter((t) => t.kind === "ball").length >= profile.maxBalls) {
            return s;
          }
          if (!profile.allowsProps && (kind === "cone" || kind === "goal")) return s;

          const id = nextTokenId(scene, kind === "player" ? (side === "away" ? "a" : "h") : kind);
          // Match whoever is already on this side, so adding an eleventh piece
          // does not reintroduce the colour the coach just changed away from.
          const sameSide = scene.tokens.find((t) => t.kind === "player" && t.side === side);
          const color =
            kind === "player" && sameSide
              ? sameSide.color
              : kind === "ball"
              ? COLORS.ball
              : kind === "cone"
                ? COLORS.cone
                : kind === "marker"
                  ? COLORS.amber
                  : kind === "goal"
                    ? COLORS.chalk
                    : side === "away"
                      ? COLORS.away
                      : COLORS.home;
          // Marks get letters and players get numbers, so a coach can say "go to
          // B" without it colliding with the shirt numbers on the same board.
          const label =
            kind === "player"
              ? String(scene.tokens.filter((t) => t.kind === "player" && t.side === side).length + 1)
              : kind === "marker"
                ? String.fromCharCode(65 + (scene.tokens.filter((t) => t.kind === "marker").length % 26))
                : "";

          scene.tokens.push({ id, kind, side, label, color });
          const at = { x: 20, y: kind === "player" ? (side === "away" ? 17 : 3) : 10 };
          for (const step of scene.steps) step.positions[id] = { ...at };

          return { scene, selectedId: id, revision: s.revision + 1 };
        }),

      removeToken: (id) =>
        set((s) => {
          const scene = clone(s.scene);
          scene.tokens = scene.tokens.filter((t) => t.id !== id);
          for (const step of scene.steps) {
            step.moves = step.moves.filter((m) => m.tokenId !== id);
            delete step.positions[id];
          }
          if (scene.attachments) {
            delete scene.attachments[id];
            for (const [ball, carrier] of Object.entries(scene.attachments)) {
              if (carrier === id) delete scene.attachments[ball];
            }
          }
          return { scene, selectedId: null, revision: s.revision + 1 };
        }),

      setTokenColor: (id, color) =>
        set((s) => {
          const scene = clone(s.scene);
          const token = scene.tokens.find((t) => t.id === id);
          if (!token) return s;
          token.color = color;
          return { scene, revision: s.revision + 1 };
        }),

      setTokenLabel: (id, label) =>
        set((s) => {
          const scene = clone(s.scene);
          const token = scene.tokens.find((t) => t.id === id);
          if (!token) return s;
          token.label = label.slice(0, 3);
          return { scene, revision: s.revision + 1 };
        }),

      setPitch: (colours) =>
        set((s) => {
          const scene = clone(s.scene);
          scene.pitch = { ...scene.pitch, ...colours };
          return { scene, revision: s.revision + 1 };
        }),

      /**
       * A line drawn on the court itself. Simplified like a movement path — a
       * pointer emits far more points than the shape needs, and thirty of these
       * are stored in the same JSONB column as the whole play.
       */
      addPitchMark: (points, color) =>
        set((s) => {
          if (s.scene.pitch.marks.length >= MAX_PITCH_MARKS) return s;
          const simplified = simplify(points, 0.3).slice(0, 120);
          if (simplified.length < 2) return s;

          const scene = clone(s.scene);
          scene.pitch.marks.push({
            id: `m${Date.now().toString(36)}`,
            points: simplified,
            color,
          });
          return { scene, revision: s.revision + 1 };
        }),

      undoPitchMark: () =>
        set((s) => {
          if (s.scene.pitch.marks.length === 0) return s;
          const scene = clone(s.scene);
          scene.pitch.marks.pop();
          return { scene, revision: s.revision + 1 };
        }),

      clearPitchMarks: () =>
        set((s) => {
          if (s.scene.pitch.marks.length === 0) return s;
          const scene = clone(s.scene);
          scene.pitch.marks = [];
          return { scene, revision: s.revision + 1 };
        }),

      attachBall: (ballId, carrierId) =>
        set((s) => {
          const scene = clone(s.scene);
          scene.attachments ??= {};
          if (carrierId) scene.attachments[ballId] = carrierId;
          else delete scene.attachments[ballId];
          return { scene, revision: s.revision + 1 };
        }),
    }),
    {
      // Undo/redo is about the document, not about which step you are looking at.
      partialize: (state) => ({ scene: state.scene }),
      limit: 120,
      equality: (a, b) => a.scene === b.scene,
    },
  ),
);

type TemporalState = ReturnType<typeof useEditor.temporal.getState>;

export const useTemporal = <T,>(selector: (state: TemporalState) => T): T =>
  useStore(useEditor.temporal, selector);
