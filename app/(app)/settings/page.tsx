import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { PitchPicker } from "@/components/pitch-picker";
import { requireCoach } from "@/lib/auth/session";
import {
  createDrillType,
  deleteDrillType,
  renameDrillType,
  seedDefaultTypes,
} from "@/lib/drills/type-actions";
import { SUGGESTED_TYPES, listDrillTypes } from "@/lib/drills/types";
import { newScene } from "@/lib/presets";
import { resetPitchPreference, savePitchPreference } from "@/lib/settings/actions";
import { getPitchDefaults } from "@/lib/settings/queries";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Definições · Quadra" };

/**
 * Everything a coach sets once and stops thinking about. Both of these used to
 * sit where the work happens — the court colours inside the editor's roster
 * panel, the types on a page of their own — and neither belongs there: you do
 * not choose your vocabulary while drawing a play.
 */
export default async function SettingsPage() {
  const user = await requireCoach();
  const [pitch, types] = await Promise.all([getPitchDefaults(user.id), listDrillTypes(user.id)]);

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
        <h2>Tipos de jogada</h2>
        <p className={styles.meta} style={{ textTransform: "none", letterSpacing: 0, marginBottom: 14 }}>
          Os tipos são teus: ataque, defesa, bolas paradas, o que fizer sentido para a tua equipa.
          Servem para filtrar a biblioteca quando ela tiver cinquenta jogadas em vez de cinco.
        </p>

        <form action={createDrillType} className={styles.inline} style={{ marginBottom: 12 }}>
          <input name="name" placeholder="Ataque" required maxLength={40} aria-label="Nome do tipo" />
          <button className="btn btn-primary" type="submit">
            Criar tipo
          </button>
          {types.length === 0 ? null : (
            <Link href="/drills" className={styles.meta} style={{ marginLeft: 4 }}>
              Ver a biblioteca →
            </Link>
          )}
        </form>

        {types.length === 0 ? (
          <div className={styles.empty}>
            <b>Ainda não há tipos</b>
            <p>Sem eles a biblioteca mostra tudo junto, o que só incomoda a partir de umas dezenas.</p>
            <form action={seedDefaultTypes}>
              <button className="btn btn-primary" type="submit">
                Criar os sugeridos ({SUGGESTED_TYPES.join(", ")})
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className={styles.rows}>
              {types.map((type) => (
                <div key={type.id} className={styles.row}>
                  <form action={renameDrillType} className={styles.inline + " " + styles.rowMain}>
                    <input type="hidden" name="id" value={type.id} />
                    <input
                      name="name"
                      defaultValue={type.name}
                      maxLength={40}
                      aria-label={"Nome de " + type.name}
                      style={{ minWidth: 180 }}
                    />
                    <button className="btn" type="submit">
                      Mudar nome
                    </button>
                  </form>
                  <form action={deleteDrillType}>
                    <input type="hidden" name="id" value={type.id} />
                    <ConfirmButton message={`Apagar o tipo "${type.name}"? As jogadas ficam sem tipo.`}>
                      Apagar
                    </ConfirmButton>
                  </form>
                </div>
              ))}
            </div>
            <p className={styles.meta} style={{ marginTop: 12, textTransform: "none", letterSpacing: 0 }}>
              Apagar um tipo não apaga as jogadas: ficam sem tipo e podes voltar a classificá-las.
            </p>
          </>
        )}
      </section>

      <section className={styles.section}>
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
