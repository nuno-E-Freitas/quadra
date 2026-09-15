"use client";

import { useEffect } from "react";
import type { Scene } from "@/lib/scene";
import { BoardView } from "./board-view";
import { usePlayback } from "./use-playback";
import styles from "./editor.module.css";

/**
 * The player-facing view: read-only, autoplaying, no login. This is the actual
 * point of the product — a link that shows where you go and where the ball goes.
 */
export function Player({ scene, title }: { scene: Scene; title: string }) {
  const playback = usePlayback(scene, { autoPlay: true });
  const step = playback.activeStep > 0 ? scene.steps[playback.activeStep] : null;

  useEffect(() => {
    document.title = `${title} · Quadra`;
  }, [title]);

  return (
    <div className={styles.board}>
      <div className={styles.pitch}>
        <BoardView scene={scene} positions={playback.frame.positions} moves={playback.frame.moves} />
      </div>

      {playback.total > 0 ? (
        <>
          <div className={styles.transport}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => (playback.playing ? playback.stop() : playback.play())}
            >
              {playback.playing ? "■ Pause" : playback.elapsed >= playback.total ? "▶ Again" : "▶ Play"}
            </button>
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
          <p className={styles.hint}>
            {step?.note ? (
              <>
                <b>Step {playback.activeStep}.</b> {step.note}
              </>
            ) : (
              <>
                {scene.steps.length - 1} step{scene.steps.length === 2 ? "" : "s"} · tap play to watch it again
              </>
            )}
          </p>
        </>
      ) : (
        <p className={styles.hint}>This one is a setup only — no movement recorded yet.</p>
      )}
    </div>
  );
}
