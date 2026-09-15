"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { pointAtLength, sample, type Sampled } from "@/lib/geometry";
import type { Scene, Vec } from "@/lib/scene";
import type { DrawnMove } from "./board-view";

/** 0.25x is for picking apart a rotation; 2x is for a quick recap. */
export const SPEEDS = [0.25, 0.5, 1, 2] as const;

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
  const [speed, setSpeedState] = useState(1);
  const raf = useRef(0);
  const startedAt = useRef(0);
  const offset = useRef(0);
  /** Where the run must halt, for "play one step and wait". null = run to the end. */
  const haltAt = useRef<number | null>(null);

  const reduced = useReducedMotion();

  /**
   * A viewer who asks the system for reduced motion gets the run at double rate
   * by default — the same movement, less of it on screen. But tapping a speed is
   * a deliberate choice and outranks the heuristic from then on; otherwise 0.5x
   * silently played at 1x for exactly the people most likely to want it slow.
   */
  const speedChosen = useRef(false);
  const setSpeed = useCallback((rate: number) => {
    speedChosen.current = true;
    setSpeedState(rate);
  }, []);

  useEffect(() => {
    if (reduced && !speedChosen.current) setSpeedState(2);
  }, [reduced]);

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
    haltAt.current = null;
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
    startedAt.current = performance.now();
    let last = offset.current;

    const tick = (now: number) => {
      const next = offset.current + (now - startedAt.current) * speed;
      const limit = Math.min(haltAt.current ?? Number.POSITIVE_INFINITY, timeline.total);
      if (next >= limit) {
        last = limit;
        offset.current = limit;
        setElapsed(limit);
        setPlaying(false);
        haltAt.current = null;
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
  }, [playing, speed, timeline.total]);

  /**
   * Play exactly one step and stop on its last frame. Coaches teach a play one
   * beat at a time — stopping on the beat is more useful than slowing it down.
   */
  const playStep = useCallback(() => {
    if (timeline.total === 0) return;
    const from = offset.current >= timeline.total ? 0 : offset.current;
    // A hair past the boundary, so resting exactly on a step end picks the next.
    const step =
      timeline.segments.find((seg) => from < seg.end - 1) ?? timeline.segments[timeline.segments.length - 1];
    if (!step) return;
    if (from < step.start) {
      offset.current = step.start;
      setElapsed(step.start);
    } else if (offset.current >= timeline.total) {
      offset.current = 0;
      setElapsed(0);
    }
    haltAt.current = step.end;
    setPlaying(true);
  }, [timeline.segments, timeline.total]);

  const frame = useMemo(() => frameAt(elapsed), [frameAt, elapsed]);

  return {
    playing,
    elapsed,
    total: timeline.total,
    speed,
    setSpeed,
    play,
    playStep,
    stop,
    reset,
    seek,
    frame,
    /** False once the playhead is resting on the final step's last frame. */
    hasNextStep: timeline.total > 0 && elapsed < timeline.total,
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
