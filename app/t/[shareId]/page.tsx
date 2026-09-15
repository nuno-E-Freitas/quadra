import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardView } from "@/components/board/board-view";
import { Wordmark } from "@/components/wordmark";
import { sceneSchema } from "@/lib/scene";
import { getTrainingByShareId } from "@/lib/trainings/queries";
import shell from "@/app/b/[shareId]/share.module.css";
import styles from "./training.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const training = await getTrainingByShareId(shareId);
  return {
    title: training ? training.title + " · Quadra" : "Quadra",
    robots: { index: false, follow: false },
  };
}

/**
 * The whole session behind one unguessable link — the thing a coach actually
 * pastes into the group chat. Each drill shows its setup as a still, so the
 * squad can see the shape before deciding to open it; tapping one goes to the
 * board that plays.
 */
export default async function TrainingSharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const training = await getTrainingByShareId(shareId);
  if (!training) notFound();

  return (
    <main className={shell.shell}>
      <header className={shell.head}>
        <span className="eyebrow">
          {training.teamName ? training.teamName + " · training" : "training"}
        </span>
        <h1>{training.title}</h1>
        {training.scheduledFor ? (
          <span className={styles.num}>
            {training.scheduledFor.toLocaleDateString(undefined, {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
        ) : null}
        {training.description ? <p className={styles.intro}>{training.description}</p> : null}
      </header>

      {training.items.length === 0 ? (
        <p className={styles.intro}>Your coach has not added anything to this session yet.</p>
      ) : (
        <div className={styles.list}>
          {training.items.map((item, i) => {
            const scene = sceneSchema.safeParse(item.scene);
            const steps = scene.success ? Math.max(0, scene.data.steps.length - 1) : 0;

            return (
              <article key={item.drillId} className={styles.item}>
                <div className={styles.thumb}>
                  {scene.success ? (
                    <BoardView scene={scene.data} positions={scene.data.steps[0].positions} />
                  ) : null}
                </div>

                <div className={styles.body}>
                  <span className={styles.num}>
                    {i + 1} · {item.kind} · {steps} step{steps === 1 ? "" : "s"}
                  </span>
                  <h2>{item.title}</h2>
                  {item.note ? <p className={styles.note}>{item.note}</p> : null}
                  <Link className={"btn btn-primary " + styles.open} href={"/b/" + item.shareId}>
                    Watch it
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className={shell.foot}>
        <Wordmark />
      </footer>
    </main>
  );
}
