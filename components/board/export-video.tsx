"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { canRecord, downloadBlob, recordBoard, slugify } from "@/lib/export/record";

/** Recording support cannot change while the page is open. */
const subscribeNever = () => () => {};

type Playback = {
  total: number;
  speed: number;
  reset: () => void;
  play: () => void;
  stop: () => void;
  setSpeed: (rate: number) => void;
};

/**
 * Recording watches the ordinary playback rather than driving its own clock, so
 * the file always matches what the board just showed. The run is forced to 1x:
 * a coach who was studying a rotation at 0.25x still wants to send it at speed.
 */
export function ExportVideo({
  svgRef,
  playback,
  title,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>;
  playback: Playback;
  title: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "error">("idle");
  const busy = useRef(false);

  // canRecord() is false on the server and true in most browsers, so reading it
  // during render would make the two disagree about whether this button exists.
  // The server snapshot is false and the client's is the real answer — the same
  // shape use-playback uses for prefers-reduced-motion.
  const supported = useSyncExternalStore(subscribeNever, canRecord, () => false);

  if (playback.total === 0 || !supported) return null;

  async function run() {
    const svg = svgRef.current;
    if (!svg || busy.current) return;
    busy.current = true;
    setState("recording");

    const wasSpeed = playback.speed;
    try {
      playback.stop();
      playback.reset();
      playback.setSpeed(1);
      playback.play();
      // A short tail so the last frame is not clipped by the encoder flushing.
      const { blob, extension } = await recordBoard(svgRef.current!, playback.total + 350);
      downloadBlob(blob, `${slugify(title)}.${extension}`);
      setState("idle");
    } catch {
      setState("error");
    } finally {
      playback.stop();
      playback.reset();
      playback.setSpeed(wasSpeed);
      busy.current = false;
    }
  }

  return (
    <button
      className="btn"
      type="button"
      onClick={run}
      disabled={state === "recording"}
      title="Gravar a jogada em vídeo para enviar no WhatsApp"
    >
      {state === "recording" ? "A gravar…" : state === "error" ? "Falhou — tenta outra vez" : "↓ Vídeo"}
    </button>
  );
}
