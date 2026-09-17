import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserPreferences } from "@/db/schema";
import { DEFAULT_PITCH } from "@/lib/presets";
import { PITCH_OVERLAYS, type PitchOverlay } from "@/lib/scene";

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.preferences ?? {};
}

/** The court a new scene should start with for this coach. */
export async function getPitchDefaults(userId: string) {
  const prefs = await getPreferences(userId);
  const stored = prefs.pitch ?? {};

  // JSONB holds whatever was written to it, including a name from a version of
  // this app that offered an overlay we no longer do — so read it as strings
  // and keep only what the scene schema would still accept.
  const overlays = (stored.overlays ?? []).filter((name): name is PitchOverlay =>
    (PITCH_OVERLAYS as readonly string[]).includes(name),
  );

  return { ...DEFAULT_PITCH, ...stored, overlays };
}
