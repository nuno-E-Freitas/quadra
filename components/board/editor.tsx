"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveDrill } from "@/lib/drills/actions";
import { useEditor, useTemporal } from "@/lib/editor-store";
import { MOVE_STYLE } from "@/lib/geometry";
import { PALETTE } from "@/lib/presets";
import { PROFILES, moveKinds, type Scene, type Vec } from "@/lib/scene";
import { BoardView, type DrawnMove } from "./board-view";
import { usePlayback } from "./use-playback";
import styles from "./editor.module.css";

type DrillProps = {
  id: string;
  title: string;
  shareId: string;
  scene: Scene;
};

/** Below this, a drag was a tap: select the token instead of recording a path. */
const TAP_THRESHOLD_M = 0.8;

export function Editor({ drill }: { drill: DrillProps }) {
  /**
   * The store is a module singleton, and zustand serves SSR from
   * `getInitialState()` — so the server (and the very first client render)
   * draws straight from the prop, and the client seeds the store on mount.
   * The page keys this component by drill id, so another drill is a fresh mount.
   */
  useEffect(() => {
    useEditor.getState().load(drill.scene);
    useEditor.temporal.getState().clear();
    // Mount only: re-seeding on a later `drill.scene` identity change would
    // throw away edits that have not been saved yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill.id]);

  const scene = useEditor((s) => s.scene) ?? drill.scene;
  const stepIndex = useEditor((s) => s.stepIndex);
  const selectedId = useEditor((s) => s.selectedId);
  const tool = useEditor((s) => s.tool);
  const revision = useEditor((s) => s.revision);

  const [title, setTitle] = useState(drill.title);
  /** What the server last confirmed; anything newer is unsaved. */
  const [saved, setSaved] = useState({ revision: 0, title: drill.title });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dirty = revision !== saved.revision || title !== saved.title;
  const touched = revision > 0 || title !== drill.title;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; points: Vec[]; travelled: number; offset: Vec } | null>(null);
  const [live, setLive] = useState<{ id: string; points: Vec[]; color: string } | null>(null);

  const playback = usePlayback(scene);
  const viewingPlayback = playback.playing || playback.elapsed > 0;

  const undo = useTemporal((t) => t.undo);
  const redo = useTemporal((t) => t.redo);
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  const step = scene.steps[stepIndex];
  const profile = PROFILES[scene.kind];
  const selected = scene.tokens.find((t) => t.id === selectedId) ?? null;

  /* ---------- autosave ---------- */
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      const snapshot = useEditor.getState();
      const result = await saveDrill(drill.id, { title, scene: snapshot.scene });
      if (result.ok) {
        setSaved({ revision: snapshot.revision, title });
        setSaveError(null);
      } else {
        setSaveError(result.error);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [dirty, revision, title, drill.id]);

  /* ---------- pointer drag ---------- */
  const toPitch = useCallback((event: { clientX: number; clientY: number }): Vec => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }, []);

  const onTokenPointerDown = useCallback(
    (id: string, event: React.PointerEvent<SVGGElement>) => {
      if (playback.playing) return;
      event.preventDefault();
      const at = scene.steps[stepIndex].positions[id];
      if (!at) return;
      const pointer = toPitch(event);
      dragRef.current = {
        id,
        points: [{ ...at }],
        travelled: 0,
        offset: { x: at.x - pointer.x, y: at.y - pointer.y },
      };
      const token = scene.tokens.find((t) => t.id === id);
      setLive({ id, points: [{ ...at }], color: token?.kind === "ball" ? "#ffffff" : (token?.color ?? "#fff") });
      useEditor.getState().select(id);
    },
    [playback.playing, scene.steps, scene.tokens, stepIndex, toPitch],
  );

  useEffect(() => {
    if (!live) return;

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pointer = toPitch(event);
      const next = {
        x: clamp(pointer.x + drag.offset.x, -1.6, 41.6),
        y: clamp(pointer.y + drag.offset.y, -1.6, 21.6),
      };
      const last = drag.points[drag.points.length - 1];
      const delta = Math.hypot(next.x - last.x, next.y - last.y);
      if (delta > 0.15) {
        drag.points.push(next);
        drag.travelled += delta;
      }
      setLive((current) => (current ? { ...current, points: [...drag.points, next] } : current));
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setLive(null);
      if (!drag) return;
      if (drag.travelled < TAP_THRESHOLD_M) return; // a tap: selection already happened
      useEditor.getState().recordDrag(drag.id, drag.points);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [live, toPitch]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        useEditor.getState().removeToken(selectedId);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        if (playback.playing) playback.stop();
        else playback.play();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo, selectedId, playback]);

  /* ---------- what the board shows ---------- */
  const editPositions = useMemo(() => {
    const positions = { ...step.positions };
    if (live && live.points.length) positions[live.id] = live.points[live.points.length - 1];
    return positions;
  }, [step.positions, live]);

  const editMoves: DrawnMove[] = useMemo(
    () => step.moves.map((move) => ({ move, progress: 1 })),
    [step.moves],
  );

  const shareUrl = typeof window === "undefined" ? `/b/${drill.shareId}` : `${window.location.origin}/b/${drill.shareId}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
          maxLength={120}
        />
        <div className={styles.rowRight}>
          <span className={`${styles.status} ${saveError ? styles.statusError : ""}`}>
            {saveError ? "Not saved" : !touched ? "" : dirty ? "Saving…" : "Saved"}
          </span>
          <button className="btn" type="button" onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button className="btn" type="button" onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            Redo
          </button>
          <button
            className="btn"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Link copied" : "Copy share link"}
          </button>
          <Link className="btn" href={`/b/${drill.shareId}`} target="_blank">
            Open
          </Link>
        </div>
      </div>

      {saveError ? <p className="alert">{saveError}</p> : null}

      <div className={styles.board}>
        <div className={styles.bar}>
          <div className={styles.segs} role="group" aria-label="Line type">
            {moveKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className={styles.seg}
                aria-pressed={tool === kind}
                disabled={stepIndex === 0}
                onClick={() => useEditor.getState().setTool(kind)}
              >
                {MOVE_STYLE[kind].label}
              </button>
            ))}
          </div>
          <div className={styles.rowRight}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => (playback.playing ? playback.stop() : playback.play())}
              disabled={scene.steps.length < 2}
            >
              {playback.playing ? "■ Stop" : "▶ Play the move"}
            </button>
            <button className="btn" type="button" onClick={() => playback.reset()} disabled={playback.elapsed === 0}>
              Reset
            </button>
          </div>
        </div>

        <div className={styles.pitch}>
          <BoardView
            ref={svgRef}
            scene={scene}
            positions={viewingPlayback ? playback.frame.positions : editPositions}
            moves={viewingPlayback ? playback.frame.moves : editMoves}
            live={live && live.points.length > 1 ? { points: live.points, color: live.color } : null}
            selectedId={viewingPlayback ? null : selectedId}
            draggingId={live?.id ?? null}
            interactive={!playback.playing}
            onTokenPointerDown={onTokenPointerDown}
            onBackgroundPointerDown={() => useEditor.getState().select(null)}
          />
        </div>

        {scene.steps.length > 1 ? (
          <div className={styles.transport}>
            <input
              className={styles.scrub}
              type="range"
              min={0}
              max={playback.total}
              step={10}
              value={Math.round(playback.elapsed)}
              onChange={(e) => playback.seek(Number(e.target.value))}
              aria-label="Scrub playback"
            />
            <span className={styles.count}>
              {(playback.elapsed / 1000).toFixed(1)}s / {(playback.total / 1000).toFixed(1)}s
            </span>
            <div className={styles.segs} role="group" aria-label="Speed">
              {[0.5, 1, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={styles.seg}
                  aria-pressed={playback.speed === rate}
                  onClick={() => playback.setSpeed(rate)}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className={styles.hint}>
          {stepIndex === 0 ? (
            <>
              <b>Setup.</b> Drag tokens to place them; tap one to recolour or relabel it. Add a step to
              start recording movement.
            </>
          ) : (
            <>
              <b>Step {stepIndex}.</b> Drag a token to draw its path as a{" "}
              <b>{MOVE_STYLE[tool].label.toLowerCase()}</b>. Dragging the same token again replaces its
              path. Tap to select.
            </>
          )}
        </p>
      </div>

      <div className={styles.panels}>
        <section className={styles.panel}>
          <h2>Steps</h2>
          <div className={styles.steps}>
            {scene.steps.map((s, index) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.step} ${playback.playing && playback.activeStep === index ? styles.stepPlaying : ""}`}
                aria-pressed={stepIndex === index}
                onClick={() => {
                  playback.reset();
                  useEditor.getState().setStep(index);
                }}
              >
                {index === 0 ? "Setup" : `Step ${index}`}
                {index > 0 ? <span className={styles.count}>{s.moves.length}</span> : null}
              </button>
            ))}
            <button className="btn" type="button" onClick={() => useEditor.getState().addStep()}>
              + Add step
            </button>
          </div>

          {stepIndex > 0 ? (
            <div className={styles.noteRow}>
              <div className="field">
                <label htmlFor="note">Note</label>
                <input
                  id="note"
                  value={step.note ?? ""}
                  placeholder="ala fixes the marker before cutting"
                  maxLength={280}
                  onChange={(e) => useEditor.getState().setStepNote(stepIndex, e.target.value)}
                />
              </div>
              <div className={`field ${styles.duration}`}>
                <label htmlFor="duration">Seconds</label>
                <input
                  id="duration"
                  type="number"
                  min={0.2}
                  max={20}
                  step={0.1}
                  value={(step.durationMs / 1000).toFixed(1)}
                  onChange={(e) => useEditor.getState().setStepDuration(stepIndex, Number(e.target.value) * 1000)}
                />
              </div>
              <button className="btn" type="button" onClick={() => useEditor.getState().clearStepMoves()}>
                Clear paths
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => useEditor.getState().deleteStep(stepIndex)}
                disabled={scene.steps.length <= 1}
              >
                Delete step
              </button>
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <h2>Roster · {profile.caption}</h2>
          <div className={styles.roster}>
            {scene.tokens.map((token) => (
              <button
                key={token.id}
                type="button"
                className={styles.rosterRow}
                aria-pressed={selectedId === token.id}
                onClick={() => useEditor.getState().select(token.id)}
              >
                <i className={styles.dot} style={{ background: token.color }} />
                <span>
                  {token.kind === "player" ? `${token.label || "–"} · ${token.side}` : token.kind}
                </span>
              </button>
            ))}
          </div>

          <div className={styles.inline}>
            <button className="btn" type="button" onClick={() => useEditor.getState().addToken("player", "home")}>
              + Home
            </button>
            <button className="btn" type="button" onClick={() => useEditor.getState().addToken("player", "away")}>
              + Away
            </button>
            {profile.allowsProps ? (
              <button className="btn" type="button" onClick={() => useEditor.getState().addToken("cone", "neutral")}>
                + Cone
              </button>
            ) : null}
          </div>

          {selected ? (
            <>
              <h2>Selected · {selected.kind}</h2>
              {selected.kind === "player" ? (
                <>
                  <div className={styles.inline}>
                    <div className={`field ${styles.labelInput}`}>
                      <label htmlFor="label">Label</label>
                      <input
                        id="label"
                        value={selected.label}
                        maxLength={3}
                        onChange={(e) => useEditor.getState().setTokenLabel(selected.id, e.target.value)}
                      />
                    </div>
                  </div>
                  <div className={styles.swatches}>
                    {PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={styles.sw}
                        style={{ background: color }}
                        aria-label={`Colour ${color}`}
                        aria-pressed={selected.color.toLowerCase() === color.toLowerCase()}
                        onClick={() => useEditor.getState().setTokenColor(selected.id, color)}
                      />
                    ))}
                  </div>
                </>
              ) : null}

              {selected.kind === "ball" ? (
                <div className={styles.inline}>
                  <span className={styles.count}>Carried by</span>
                  <select
                    value={scene.attachments?.[selected.id] ?? ""}
                    onChange={(e) => useEditor.getState().attachBall(selected.id, e.target.value || null)}
                  >
                    <option value="">nobody</option>
                    {scene.tokens
                      .filter((t) => t.kind === "player")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label || t.id} · {t.side}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}

              <button className="btn" type="button" onClick={() => useEditor.getState().removeToken(selected.id)}>
                Remove token
              </button>
            </>
          ) : null}

          <p className={styles.share}>{shareUrl}</p>
        </section>
      </div>
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
