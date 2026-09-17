import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserPreferences } from "@/db/schema";
import { DEFAULT_PITCH } from "@/lib/presets";

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.preferences ?? {};
}

/** The colours a new scene should start with for this coach. */
export async function getPitchDefaults(userId: string) {
  const prefs = await getPreferences(userId);
  return { ...DEFAULT_PITCH, ...(prefs.pitch ?? {}) };
}
