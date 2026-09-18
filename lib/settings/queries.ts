import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type UserPreferences } from "@/db/schema";
import { DEFAULT_PIECE_COLOURS, DEFAULT_PITCH } from "@/lib/presets";
import { PITCH_OVERLAYS, pitchMarkSchema, type PitchOverlay } from "@/lib/scene";

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.preferences ?? {};
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The kit a new scene dresses the two sides in for this coach. */
export async function getPieceDefaults(userId: string) {
  const stored = (await getPreferences(userId)).pieces ?? {};
  return {
    home: HEX.test(stored.home ?? "") ? stored.home! : DEFAULT_PIECE_COLOURS.home,
    away: HEX.test(stored.away ?? "") ? stored.away! : DEFAULT_PIECE_COLOURS.away,
  };
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

  // Same reasoning for the drawn lines: whatever is in the column gets parsed,
  // and anything that would not survive the scene schema is dropped rather than
  // carried into a new play that then refuses to save.
  const marks = (stored.marks ?? [])
    .map((mark) => pitchMarkSchema.safeParse(mark))
    .filter((result) => result.success)
    .map((result) => result.data);

  return { ...DEFAULT_PITCH, ...stored, overlays, marks };
}
