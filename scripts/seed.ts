/**
 * Creates a demo coach and one worked play, so a fresh database has something
 * to look at. Safe to re-run: it replaces the demo account each time.
 *
 *   pnpm db:seed
 */
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { drills, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { newScene } from "@/lib/presets";
import { validateScene } from "@/lib/scene";

const EMAIL = "demo@quadra.local";
const PASSWORD = "quadra-demo";

function demoPlay() {
  const scene = newScene("play");

  scene.steps.push({
    id: "s1",
    durationMs: 1250,
    moves: [
      { tokenId: "ball", kind: "pass", points: [{ x: 27.1, y: 3.9 }, { x: 32.1, y: 9.2 }] },
      { tokenId: "h4", kind: "run", points: [{ x: 26, y: 3 }, { x: 28.6, y: 2.2 }, { x: 30.6, y: 2.5 }] },
      { tokenId: "h3", kind: "run", points: [{ x: 26, y: 17 }, { x: 28, y: 16.4 }, { x: 29.6, y: 16 }] },
    ],
    positions: {
      ...scene.steps[0].positions,
      ball: { x: 32.1, y: 9.2 },
      h4: { x: 30.6, y: 2.5 },
      h3: { x: 29.6, y: 16 },
    },
    note: "Pass into the pivot, ala overlaps outside",
  });

  scene.steps.push({
    id: "s2",
    durationMs: 1150,
    moves: [
      { tokenId: "ball", kind: "pass", points: [{ x: 32.1, y: 9.2 }, { x: 33.8, y: 3.6 }] },
      { tokenId: "h4", kind: "run", points: [{ x: 30.6, y: 2.5 }, { x: 32.4, y: 2.9 }, { x: 33.7, y: 3.9 }] },
      { tokenId: "h5", kind: "run", points: [{ x: 33, y: 10 }, { x: 34.6, y: 9.4 }, { x: 35.8, y: 8.6 }] },
      { tokenId: "h3", kind: "run", points: [{ x: 29.6, y: 16 }, { x: 33, y: 15.7 }, { x: 36, y: 13.4 }] },
    ],
    positions: {
      ...scene.steps[1].positions,
      ball: { x: 33.8, y: 3.6 },
      h4: { x: 33.7, y: 3.9 },
      h5: { x: 35.8, y: 8.6 },
      h3: { x: 36, y: 13.4 },
    },
    note: "Ball back out wide, pivot fixes the marker",
  });

  scene.steps.push({
    id: "s3",
    durationMs: 1000,
    moves: [{ tokenId: "ball", kind: "shot", points: [{ x: 33.8, y: 3.6 }, { x: 39.5, y: 9.3 }] }],
    positions: { ...scene.steps[2].positions, ball: { x: 39.5, y: 9.3 } },
    note: "Finish far post",
  });

  return scene;
}

async function main() {
  await db.delete(users).where(eq(users.email, EMAIL));

  const [user] = await db
    .insert(users)
    .values({ name: "Demo coach", email: EMAIL, passwordHash: await hashPassword(PASSWORD) })
    .returning({ id: users.id });

  const scene = demoPlay();
  const validated = validateScene(scene);
  if (!validated.success) throw new Error("seed scene is invalid");

  const [drill] = await db
    .insert(drills)
    .values({
      ownerId: user.id,
      kind: "play",
      title: "Overload right, finish far post",
      scene,
      shareId: nanoid(12),
      tags: ["ataque", "5v5"],
    })
    .returning({ shareId: drills.shareId });

  console.log(`Seeded ${EMAIL} / ${PASSWORD}`);
  console.log(`Share link: /b/${drill.shareId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
