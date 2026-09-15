import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { Player } from "@/components/board/player";
import { Wordmark } from "@/components/wordmark";
import { sceneSchema } from "@/lib/scene";
import styles from "./share.module.css";

async function load(shareId: string) {
  const [row] = await db
    .select({ title: drills.title, kind: drills.kind, scene: drills.scene })
    .from(drills)
    .where(eq(drills.shareId, shareId))
    .limit(1);
  return row;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const row = await load(shareId);
  return {
    title: row ? `${row.title} · Quadra` : "Quadra",
    robots: { index: false, follow: false },
  };
}

/** Public on purpose: an unguessable link, no login, opened on a phone. */
export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const row = await load(shareId);
  if (!row) notFound();

  const scene = sceneSchema.safeParse(row.scene);
  if (!scene.success) notFound();

  return (
    <main className={styles.shell}>
      <header className={styles.head}>
        <span className="eyebrow">{row.kind}</span>
        <h1>{row.title}</h1>
      </header>

      <Player scene={scene.data} title={row.title} />

      <footer className={styles.foot}>
        <Wordmark />
      </footer>
    </main>
  );
}
