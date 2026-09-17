"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveDrill } from "@/lib/drills/actions";
import { useEditor, useTemporal } from "@/lib/editor-store";
import { MOVE_STYLE } from "@/lib/geometry";
import { PALETTE, PITCH_PRESETS } from "@/lib/presets";
import { PITCH_OVERLAYS, PROFILES, moveKinds, type PitchOverlay, type Scene, type Vec } from "@/lib/scene";
import { BoardView, type DrawnMove } from "./board-view";
import { OVERLAY_LABEL } from "./pitch";
import { usePlayback, SPEEDS } from "./use-playback";
import { ExportVideo } from "./export-video";
import styles from "./editor.module.css";

type DrillProps = {
  id: string;
  title: string;
  shareId: string;
  /**
   * Built on the server from the request headers. Deriving it here from
   * window.location instead would mean the server rendered a relative path and
   * the client an absolute one — the two disagree, and React throws out the
   * whole tree and redraws it.
   */
  shareUrl: string;
  scene: Scene;
};

/** Below this, a drag was a tap: select the token instead of recording a path. */
const TAP_THRESHOLD_M = 0.8;

/** Sides and piece kinds are stored in English; only their display is Portuguese. */
const SIDE_PT: Record<string, string> = { home: "nossa", away: "adversária", neutral: "neutra" };
const KIND_PT: Record<string, string> = {
  player: "jogador",
  ball: "bola",
  cone: "cone",
  marker: "marca",
  goal: "baliza",
};


/** The three jobs this page does, and the order a play goes through them. */
type Mode = "montar" | "gravar" | "rever";

const MODES: [Mode, string, string][] = [
  ["montar", "Montar", "Arrumar as peças onde a jogada começa"],
  ["gravar", "Gravar", "Desenhar o movimento"],
  ["rever", "Rever", "Ver e enviar, como os jogadores vão ver"],
];

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
  const recording = useEditor((s) => s.recording);

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

  const shareUrl = drill.shareUrl;

  const [mode, setMode] = useState<Mode>(drill.scene.steps.length > 1 ? "rever" : "montar");

  /**
   * Arranging, recording and reviewing use almost disjoint controls, and showing
   * all of them at once was what made this page feel crowded. One switch, and
   * each mode carries only its own tools.
   */
  const go = (next: Mode) => {
    if (next !== "rever") playback.reset();
    if (next === "gravar" && !recording) useEditor.getState().startRecording();
    if (next !== "gravar" && recording) useEditor.getState().stopRecording();
    setMode(next);
  };

  const onPitch = mode !== "rever" && !playback.playing;
  const showingRun = mode === "rever" && (playback.playing || playback.elapsed > 0);

  const stepStrip = (
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
          {index === 0 ? "Início" : `Momento ${index}`}
          {index > 0 ? <span className={styles.count}>{s.moves.length}</span> : null}
        </button>
      ))}
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.titleRow}>
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Título"
          maxLength={120}
        />
        <div className={styles.rowRight}>
          <span className={`${styles.status} ${saveError ? styles.statusError : ""}`}>
            {recording
              ? "● A gravar"
              : saveError
                ? "Por guardar"
                : !touched
                  ? ""
                  : dirty
                    ? "A guardar…"
                    : "Guardado"}
          </span>
          <button className="btn" type="button" onClick={() => undo()} disabled={!canUndo} title="Anular (Ctrl+Z)">
            Anular
          </button>
          <button className="btn" type="button" onClick={() => redo()} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
            Refazer
          </button>
        </div>
      </div>

      {saveError ? <p className="alert">{saveError}</p> : null}

      <div className={styles.modes} role="group" aria-label="Modo">
        {MODES.map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            className={styles.mode}
            aria-pressed={mode === key}
            onClick={() => go(key)}
            title={hint}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.pitch}>
        <BoardView
          ref={svgRef}
          scene={scene}
          positions={showingRun ? playback.frame.positions : editPositions}
          moves={showingRun ? playback.frame.moves : editMoves}
          live={live && live.points.length > 1 ? { points: live.points, color: live.color } : null}
          selectedId={showingRun ? null : selectedId}
          draggingId={live?.id ?? null}
          interactive={onPitch}
          onTokenPointerDown={onTokenPointerDown}
          onBackgroundPointerDown={() => useEditor.getState().select(null)}
        />
      </div>

      <p className={styles.hint}>
        {mode === "montar" ? (
          <>
            <b>Montar.</b> Arrasta as peças para onde a jogada começa. Toca numa para lhe mudar o
            número, a letra ou a cor. As marcas, os cones e as balizas estão em <b>Campo</b>.
          </>
        ) : mode === "gravar" ? (
          <>
            <b>A gravar · momento {stepIndex}.</b> Arrasta tudo o que se mexe agora — vários
            jogadores e a bola ficam no mesmo momento. Quando voltares a pegar num que já mexeste,
            começa um momento novo sozinho. Enganaste-te? <b>Ctrl+Z</b>.
          </>
        ) : (
          <>
            <b>Rever.</b> É isto que os jogadores vão ver. O quadro não se edita aqui — passa a{" "}
            <b>Montar</b> ou <b>Gravar</b> para lhe mexer.
          </>
        )}
      </p>

      {mode === "montar" ? (
        <div className={styles.panels}>
          <section className={styles.panel}>
            <h2>Peças · {profile.caption}</h2>
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
                    {token.kind === "player"
                      ? `${token.label || "–"} · ${SIDE_PT[token.side]}`
                      : token.kind === "marker"
                        ? `marca ${token.label || ""}`.trim()
                        : KIND_PT[token.kind]}
                  </span>
                </button>
              ))}
            </div>

            <div className={styles.inline}>
              <button className="btn" type="button" onClick={() => useEditor.getState().addToken("player", "home")}>
                + Nossa
              </button>
              <button className="btn" type="button" onClick={() => useEditor.getState().addToken("player", "away")}>
                + Adversária
              </button>
            </div>

            {selected ? (
              <>
                <h2>Selecionado · {KIND_PT[selected.kind]}</h2>
                {selected.kind === "player" || selected.kind === "marker" ? (
                  <>
                    <div className={styles.inline}>
                      <div className={`field ${styles.labelInput}`}>
                        <label htmlFor="label">{selected.kind === "marker" ? "Letra" : "Número"}</label>
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
                          aria-label={`Cor ${color}`}
                          aria-pressed={selected.color.toLowerCase() === color.toLowerCase()}
                          onClick={() => useEditor.getState().setTokenColor(selected.id, color)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {selected.kind === "ball" ? (
                  <div className={styles.inline}>
                    <span className={styles.count}>Levada por</span>
                    <select
                      value={scene.attachments?.[selected.id] ?? ""}
                      onChange={(e) => useEditor.getState().attachBall(selected.id, e.target.value || null)}
                    >
                      <option value="">ninguém</option>
                      {scene.tokens
                        .filter((t) => t.kind === "player")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label || t.id} · {SIDE_PT[t.side]}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}

                <button className="btn" type="button" onClick={() => useEditor.getState().removeToken(selected.id)}>
                  Remover peça
                </button>
              </>
            ) : null}
          </section>

          <section className={styles.panel}>
            <h2>Campo</h2>
            {/* Marks, cones and goals belong to the court, not to the squad —
                which is where a coach looks for them. */}
            <div className={styles.inline}>
              <button className="btn" type="button" onClick={() => useEditor.getState().addToken("marker", "neutral")}>
                + Marca
              </button>
              {profile.allowsProps ? (
                <>
                  <button className="btn" type="button" onClick={() => useEditor.getState().addToken("cone", "neutral")}>
                    + Cone
                  </button>
                  <button className="btn" type="button" onClick={() => useEditor.getState().addToken("goal", "neutral")}>
                    + Baliza
                  </button>
                </>
              ) : null}
            </div>
            <p className={styles.note}>
              Uma marca é um ponto de referência: onde arranca a rotação, onde se aciona a pressão.
              Ganha uma letra e arrasta-se como as outras peças.
            </p>

            <h2>Linhas do pavilhão</h2>
            <div className={styles.inline}>
              {PITCH_OVERLAYS.map((name) => {
                const on = scene.pitch.overlays.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={styles.seg}
                    aria-pressed={on}
                    onClick={() =>
                      useEditor.getState().setPitch({
                        overlays: on
                          ? scene.pitch.overlays.filter((o: PitchOverlay) => o !== name)
                          : [...scene.pitch.overlays, name],
                      })
                    }
                  >
                    {OVERLAY_LABEL[name]}
                  </button>
                );
              })}
            </div>
            <p className={styles.note}>
              As marcações das outras modalidades pintadas no mesmo chão, desenhadas por baixo. O teu
              padrão está nas Definições e vale para tudo o que criares a partir daí.
            </p>

            <details className={styles.sheet}>
              <summary>Cores da quadra</summary>
              <div className={styles.inline}>
                {PITCH_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={styles.seg}
                    aria-pressed={scene.pitch.surface === preset.surface && scene.pitch.lines === preset.lines}
                    onClick={() =>
                      useEditor.getState().setPitch({
                        surface: preset.surface,
                        lines: preset.lines,
                        surround: preset.surround,
                      })
                    }
                  >
                    <i className={styles.dot} style={{ background: preset.surface, borderColor: preset.lines }} />
                    {preset.name}
                  </button>
                ))}
              </div>
              <div className={styles.inline}>
                {(
                  [
                    ["surface", "Piso"],
                    ["lines", "Linhas"],
                    ["surround", "Fora"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className={styles.inline} style={{ gap: 5 }}>
                    <span className={styles.count}>{label}</span>
                    <input
                      type="color"
                      value={scene.pitch[key]}
                      aria-label={label}
                      onChange={(event) => useEditor.getState().setPitch({ [key]: event.target.value })}
                      style={{ width: 38, height: 28, padding: 2, cursor: "pointer" }}
                    />
                  </label>
                ))}
              </div>
              <p className={styles.note}>Vale só para esta jogada. O teu padrão está nas Definições.</p>
            </details>
          </section>
        </div>
      ) : mode === "gravar" ? (
        <div className={styles.panels}>
          <section className={styles.panel}>
            <h2>Traço</h2>
            <div className={styles.segs} role="group" aria-label="Tipo de traço">
              {moveKinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={styles.seg}
                  aria-pressed={tool === kind}
                  onClick={() => useEditor.getState().setTool(kind)}
                >
                  {MOVE_STYLE[kind].label}
                </button>
              ))}
            </div>

            <div className={styles.inline}>
              <button className="btn btn-primary" type="button" onClick={() => go("rever")}>
                ■ Terminar
              </button>
              <button className="btn" type="button" onClick={() => useEditor.getState().addStep()}>
                + Momento em branco
              </button>
            </div>

            {stepIndex > 0 ? (
              <div className={styles.noteRow}>
                <div className="field">
                  <label htmlFor="note">Nota deste momento</label>
                  <input
                    id="note"
                    value={step.note ?? ""}
                    placeholder="o ala fixa o marcador antes de cortar"
                    maxLength={280}
                    onChange={(e) => useEditor.getState().setStepNote(stepIndex, e.target.value)}
                  />
                </div>
                <div className={`field ${styles.duration}`}>
                  <label htmlFor="duration">Segundos</label>
                  <input
                    id="duration"
                    type="number"
                    min={0.2}
                    max={20}
                    step={0.1}
                    value={(step.durationMs / 1000).toFixed(1)}
                    onChange={(e) =>
                      useEditor.getState().setStepDuration(stepIndex, Number(e.target.value) * 1000)
                    }
                  />
                </div>
                <button className="btn" type="button" onClick={() => useEditor.getState().clearStepMoves()}>
                  Limpar trajetos
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => useEditor.getState().deleteStep(stepIndex)}
                  disabled={scene.steps.length <= 1}
                >
                  Apagar momento
                </button>
              </div>
            ) : null}
          </section>

          <section className={styles.panel}>
            <h2>Momentos</h2>
            {stepStrip}
          </section>
        </div>
      ) : (
        <div className={styles.panels}>
          <section className={styles.panel}>
            <h2>Reprodução</h2>
            <div className={styles.inline}>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => (playback.playing ? playback.stop() : playback.play())}
                disabled={scene.steps.length < 2}
              >
                {playback.playing ? "■ Parar" : "▶ Ver"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={playback.playStep}
                disabled={!playback.hasNextStep}
                title="Correr o momento seguinte e parar nele"
              >
                ▸| Momento
              </button>
              <button className="btn" type="button" onClick={() => playback.reset()} disabled={playback.elapsed === 0}>
                Repor
              </button>
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
                  aria-label="Percorrer"
                />
                <span className={styles.count}>
                  {(playback.elapsed / 1000).toFixed(1)}s / {(playback.total / 1000).toFixed(1)}s
                </span>
                <div className={styles.segs} role="group" aria-label="Velocidade">
                  {SPEEDS.map((rate) => (
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

            {stepStrip}
          </section>

          <section className={styles.panel}>
            <h2>Enviar</h2>
            <div className={styles.inline}>
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
                {copied ? "Link copiado" : "Copiar link"}
              </button>
              <ExportVideo svgRef={svgRef} playback={playback} title={title} />
              <Link className="btn" href={`/b/${drill.shareId}`} target="_blank">
                Abrir
              </Link>
            </div>
            <p className={styles.share}>{shareUrl}</p>
          </section>
        </div>
      )}
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
