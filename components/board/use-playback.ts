"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { pointAtLength, sample, type Sampled } from "@/lib/geometry";
import type { Scene, Vec } from "@/lib/scene";
import type { DrawnMove } from "./board-view";

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

type Frame = { positions: Record<string, Vec>; moves: DrawnMove[] };

/**
 * One requestAnimationFrame loop over a step timeline. Steps are sequential, so
 * a frame is: every finished step applied wholesale, plus the running step
 * interpolated along its paths.
 */
export function usePlayback(scene: Scene, opts?: { autoPlay?: boolean }) {
  const timeline = useMemo(() => {
    const segments: { start: number; end: number; index: number }[] = [];
    let t = 0;
    scene.steps.forEach((step, index) => {
      if (index === 0) return;
      const duration = Math.max(200, step.durationMs);
      segments.push({ start: t, end: t + duration, index });
      t += duration;
    });
    return { segments, total: t };
  }, [scene.steps]);

  const [playing, setPlaying] = useState(() => Boolean(opts?.autoPlay) && timeline.total > 0);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const raf = useRef(0);
  const startedAt = useRef(0);
  const offset = useRef(0);

  const reduced = useReducedMotion();

  const sampled = useMemo(() => {
    const map = new Map<string, Sampled>();
    scene.steps.forEach((step, i) => {
      step.moves.forEach((move, j) => map.set(`${i}:${j}`, sample(move.points)));
    });
    return map;
  }, [scene.steps]);

  const frameAt = useCallback(
    (ms: number): Frame => {
      const positions: Record<string, Vec> = { ...scene.steps[0].positions };
      const moves: DrawnMove[] = [];

      for (const seg of timeline.segments) {
        const step = scene.steps[seg.index];
        const raw = (ms - seg.start) / (seg.end - seg.start);
        if (raw <= 0) continue;

        if (raw >= 1) {
          Object.assign(positions, step.positions);
          step.moves.forEach((move) => moves.push({ move, progress: 1 }));
          continue;
        }

        const eased = easeInOutCubic(raw);
        step.moves.forEach((move, j) => {
          moves.push({ move, progress: eased });
          const s = sampled.get(`${seg.index}:${j}`);
          if (s) positions[move.tokenId] = pointAtLength(s, s.length * eased);
        });
      }

      return { positions, moves };
    },
    [scene.steps, timeline.segments, sampled],
  );

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    setPlaying(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    offset.current = 0;
    setElapsed(0);
  }, [stop]);

  const play = useCallback(() => {
    if (timeline.total === 0) return;
    if (offset.current >= timeline.total) {
      offset.current = 0;
      setElapsed(0);
    }
    setPlaying(true);
  }, [timeline.total]);

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(ms, timeline.total));
      offset.current = clamped;
      startedAt.current = performance.now();
      setElapsed(clamped);
    },
    [timeline.total],
  );

  useEffect(() => {
    if (!playing) return;
    const rate = speed * (reduced ? 2 : 1);
    startedAt.current = performance.now();
    let last = offset.current;

    const tick = (now: number) => {
      const next = offset.current + (now - startedAt.current) * rate;
      if (next >= timeline.total) {
        last = timeline.total;
        offset.current = timeline.total;
        setElapsed(timeline.total);
        setPlaying(false);
        return;
      }
      last = next;
      setElapsed(next);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      // Resume from where the playhead actually stopped, not from the last seek.
      offset.current = Math.min(last, timeline.total);
    };
  }, [playing, speed, reduced, timeline.total]);

  const frame = useMemo(() => frameAt(elapsed), [frameAt, elapsed]);

  return {
    playing,
    elapsed,
    total: timeline.total,
    speed,
    setSpeed,
    play,
    stop,
    reset,
    seek,
    frame,
    /** The step the playhead is inside, for highlighting the step strip. */
    activeStep: timeline.segments.find((s) => elapsed >= s.start && elapsed < s.end)?.index ?? 0,
  };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}
