import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { requireCoach } from "@/lib/auth/session";
import {
  createDrillType,
  deleteDrillType,
  renameDrillType,
  seedDefaultTypes,
} from "@/lib/drills/type-actions";
import { SUGGESTED_TYPES, listDrillTypes } from "@/lib/drills/types";
import styles from "../app.module.css";

export const metadata: Metadata = { title: "Tipos de jogada · Quadra" };

export default async function TypesPage() {
  const user = await requireCoach();
  const types = await listDrillTypes(user.id);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <span className="eyebrow">Tipos</span>
          <h1>Como classificas as tuas jogadas</h1>
        </div>
        <form action={createDrillType} className={styles.inline}>
          <input name="name" placeholder="Ataque" required maxLength={40} aria-label="Nome do tipo" />
          <button className="btn btn-primary" type="submit">
            Criar tipo
          </button>
        </form>
      </div>

      {types.length === 0 ? (
        <div className={styles.empty}>
          <b>Ainda não há tipos</b>
          <p>
            Os tipos são os teus: ataque, defesa, bolas paradas, o que fizer sentido para a tua equipa.
            Serve para filtrares a biblioteca quando ela tiver cinquenta jogadas em vez de cinco.
          </p>
          <form action={seedDefaultTypes}>
            <button className="btn btn-primary" type="submit">
              Criar os sugeridos ({SUGGESTED_TYPES.join(", ")})
            </button>
          </form>
        </div>
      ) : (
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
      )}

      <p className={styles.meta} style={{ marginTop: 20, textTransform: "none", letterSpacing: 0 }}>
        Apagar um tipo não apaga as jogadas: elas ficam sem tipo e podes voltar a classificá-las.
      </p>

      <p style={{ marginTop: 20 }}>
        <Link href="/drills" className={styles.meta}>
          ← Biblioteca
        </Link>
      </p>
    </>
  );
}
