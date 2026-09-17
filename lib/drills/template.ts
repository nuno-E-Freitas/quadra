import { DEFAULT_PITCH, newScene, type PitchLook } from "@/lib/presets";
import { sceneSchema, type Scene, type SceneKind } from "@/lib/scene";

/**
 * The scene a new play of a given type starts from.
 *
 * Pure on purpose — it decides what a coach sees the moment a board opens, so
 * it is worth being able to test without a database anywhere near it.
 *
 * The template supplies the shape: which pieces, standing where. The court
 * comes from the coach's own settings rather than from whatever play the
 * template was lifted off, because that is the one they asked to see
 * everywhere. Only the first step survives: a template is a starting position,
 * not somebody else's movement.
 */
export function sceneFromTemplate(
  template: unknown,
  kind: SceneKind,
  pitch: Partial<PitchLook> = {},
): Scene {
  const fallback = newScene(kind, pitch);
  if (!template) return fallback;

  const parsed = sceneSchema.safeParse(template);
  // A play's shape is not a training's, so a template only applies to its own.
  if (!parsed.success || parsed.data.kind !== kind) return fallback;

  const setup = parsed.data.steps[0];
  return {
    ...parsed.data,
    pitch: { ...parsed.data.pitch, ...DEFAULT_PITCH, ...pitch },
    steps: [{ ...setup, id: "setup", moves: [], positions: { ...setup.positions } }],
  };
}
