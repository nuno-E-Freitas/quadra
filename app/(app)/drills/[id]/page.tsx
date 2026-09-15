import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { drills } from "@/db/schema";
import { Editor } from "@/components/board/editor";
import { PublishPanel } from "@/components/publish-panel";
import { requireCoach } from "@/lib/auth/session";
import { getDrillPublications, getMyTeams } from "@/lib/teams/queries";
import { sceneSchema } from "@/lib/scene";

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCoach();

  const [row] = await db
    .select({
      id: drills.id,
      title: drills.title,
      shareId: drills.shareId,
      scene: drills.scene,
    })
    .from(drills)
    .where(and(eq(drills.id, id), eq(drills.ownerId, user.id)))
    .limit(1);

  if (!row) notFound();

  // The column is JSONB written by an older version of this app as easily as the
  // current one — parse on the way out, do not trust the shape.
  const scene = sceneSchema.safeParse(row.scene);
  if (!scene.success) notFound();

  const [teams, published] = await Promise.all([
    getMyTeams(user.id),
    getDrillPublications(row.id),
  ]);

  // Keyed by id so moving between drills remounts the editor with a clean store.
  return (
    <>
      <Editor
        key={row.id}
        drill={{ id: row.id, title: row.title, shareId: row.shareId, scene: scene.data }}
      />
      <PublishPanel
        drillId={row.id}
        teams={teams.filter((t) => t.role === "coach").map((t) => ({ id: t.id, name: t.name }))}
        publishedTo={published.map((p) => p.teamId)}
      />
    </>
  );
}
