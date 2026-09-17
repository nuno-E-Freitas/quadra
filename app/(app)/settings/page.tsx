import type { Metadata } from "next";
import Link from "next/link";
import { PitchPicker } from "@/components/pitch-picker";
import { requireCoach } from "@/lib/auth/session";
import { newScene } from "@/lib/presets";
import { resetPitchPreference, savePitchPreference } from "@/lib/settings/actions";
import { getPitchDefaults } from "@/lib/settings/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Definições · Quadra" };

export default async function SettingsPage() {
  const user = await requireCoach();
  const pitch = await getPitchDefaults(user.id);

  // A real scene, so the preview shows the court with players and a ball on it
  // rather than an empty rectangle that tells you nothing about contrast.
  const sample = newScene("play");

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Definições</span>
          <h1>{user.name}</h1>
        </div>
        <span className={styles.meta}>
          {user.email} · {user.role === "admin" ? "administrador" : "treinador"}
        </span>
      </div>

      <section className={styles.section} style={{ marginTop: 0 }}>
        <h2>Aspeto do campo</h2>
        <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginBottom: 14 }}>
          Vale para as jogadas que criares a partir daqui. As que já tens guardam as cores com que
          foram feitas — podes mudá-las uma a uma no editor.
        </p>

        <form action={savePitchPreference}>
          <PitchPicker scene={sample} initial={pitch} />
          <div className={styles.inline} style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="submit">
              Guardar
            </button>
            <button className="btn" type="submit" formAction={resetPitchPreference}>
              Voltar ao original
            </button>
          </div>
        </form>
      </section>

      <p style={{ marginTop: 28 }}>
        <Link href="/drills" className={styles.meta}>
          ← Biblioteca
        </Link>
      </p>
    </>
  );
}
