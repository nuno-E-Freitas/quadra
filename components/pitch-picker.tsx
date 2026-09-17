"use client";

import { useState } from "react";
import { BoardView } from "@/components/board/board-view";
import { PITCH_PRESETS } from "@/lib/presets";
import type { Scene } from "@/lib/scene";
import styles from "@/app/(app)/app.module.css";

type Colours = { surface: string; lines: string; surround: string };

/**
 * Three colours and a court to see them on. The preview is the point — picking
 * a line colour against an unseen surface is guesswork, and the pair that reads
 * well on a laptop can vanish on a phone in the sun.
 */
export function PitchPicker({ scene, initial }: { scene: Scene; initial: Colours }) {
  const [colours, setColours] = useState<Colours>(initial);

  const preview: Scene = { ...scene, pitch: { ...scene.pitch, ...colours } };
  const set = (key: keyof Colours) => (value: string) =>
    setColours((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div style={{ maxWidth: 520, marginBottom: 16 }}>
        <BoardView scene={preview} positions={preview.steps[0].positions} />
      </div>

      <div className={styles.inline} style={{ marginBottom: 14 }}>
        {PITCH_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className={styles.pill}
            style={{ cursor: "pointer", background: "none" }}
            onClick={() =>
              setColours({
                surface: preset.surface,
                lines: preset.lines,
                surround: preset.surround,
              })
            }
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 9,
                height: 9,
                borderRadius: 2,
                background: preset.surface,
                border: "1px solid " + preset.lines,
                marginRight: 6,
                verticalAlign: "-1px",
              }}
            />
            {preset.name}
          </button>
        ))}
      </div>

      <div className={styles.inline}>
        <Swatch label="Piso" name="surface" value={colours.surface} onChange={set("surface")} />
        <Swatch label="Linhas" name="lines" value={colours.lines} onChange={set("lines")} />
        <Swatch label="Fora" name="surround" value={colours.surround} onChange={set("surround")} />
      </div>
    </>
  );
}

function Swatch({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.inline} style={{ gap: 6 }}>
      <span className={styles.meta}>{label}</span>
      <input
        type="color"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        style={{ width: 44, height: 32, padding: 2, cursor: "pointer" }}
      />
      <code className={styles.code}>{value}</code>
    </label>
  );
}
