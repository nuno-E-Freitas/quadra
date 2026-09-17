"use client";

import { useState } from "react";
import { BoardView } from "@/components/board/board-view";
import { OVERLAY_LABEL } from "@/components/board/pitch";
import { PITCH_PRESETS } from "@/lib/presets";
import { PITCH_OVERLAYS, type PitchMark, type PitchOverlay, type Scene } from "@/lib/scene";
import styles from "@/app/(app)/app.module.css";

type Look = {
  surface: string;
  lines: string;
  surround: string;
  overlays: PitchOverlay[];
  /** Drawn in the editor and saved from there, so shown here but not editable. */
  marks: PitchMark[];
};

/**
 * Three colours, the other sports painted on the same floor, and a court to see
 * them on. The preview is the point — picking a line colour against an unseen
 * surface is guesswork, and a pair that reads well on a laptop can vanish on a
 * phone in the sun.
 */
export function PitchPicker({ scene, initial }: { scene: Scene; initial: Look }) {
  const [look, setLook] = useState<Look>(initial);

  const preview: Scene = { ...scene, pitch: { ...scene.pitch, ...look } };
  const set = (key: "surface" | "lines" | "surround") => (value: string) =>
    setLook((current) => ({ ...current, [key]: value }));

  const toggle = (name: PitchOverlay) =>
    setLook((current) => ({
      ...current,
      overlays: current.overlays.includes(name)
        ? current.overlays.filter((o) => o !== name)
        : [...current.overlays, name],
    }));

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
              setLook((current) => ({
                ...current,
                surface: preset.surface,
                lines: preset.lines,
                surround: preset.surround,
              }))
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

      <div className={styles.inline} style={{ marginBottom: 14 }}>
        <Swatch label="Piso" name="surface" value={look.surface} onChange={set("surface")} />
        <Swatch label="Linhas" name="lines" value={look.lines} onChange={set("lines")} />
        <Swatch label="Fora" name="surround" value={look.surround} onChange={set("surround")} />
      </div>

      <div>
        <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginBottom: 8 }}>
          <b>Linhas do pavilhão.</b> Desenha por baixo as marcações das outras modalidades pintadas no
          mesmo chão. É o que os jogadores têm debaixo dos pés — dizer &quot;arranca na linha azul do
          basquete&quot; vale mais do que &quot;arranca a oito metros&quot;.
        </p>
        <div className={styles.inline}>
          {PITCH_OVERLAYS.map((name) => (
            <label key={name} className={styles.pill} style={{ cursor: "pointer", gap: 6, display: "inline-flex" }}>
              <input
                type="checkbox"
                name="overlays"
                value={name}
                checked={look.overlays.includes(name)}
                onChange={() => toggle(name)}
              />
              {OVERLAY_LABEL[name]}
            </label>
          ))}
        </div>
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
