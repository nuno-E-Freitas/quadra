# Quadra

A futsal tactics board that remembers the movement. Place players and the ball on a
40 × 20 m court, drag them, and every move leaves its path behind — then send a player
a link and they see where they go and where the ball goes, in order.

## Running it

```bash
pnpm install
pnpm db:up        # Postgres 17 in Docker, host port 5434
pnpm db:migrate   # apply db/migrations
pnpm db:seed      # optional: demo@quadra.local / quadra-demo, plus one worked play
pnpm dev
```

`.env` holds `DATABASE_URL`; `.env.example` is the template. The container maps to
**5434** because 5432 and 5433 were already taken on the dev machine.

## The one idea

A play and a training drill are the same object: *a set of tokens on a court, plus an
ordered list of steps, plus the path each token takes during each step.* `play` and
`training` are two validation profiles over that one structure ([lib/scene.ts](lib/scene.ts)) —
a play locks to 5 v 5 with one ball, a training allows up to 20 tokens, free colours
and cones. One editor, one renderer, one playback engine, one table.

## Shape of the code

| Path | What it holds |
| --- | --- |
| [lib/scene.ts](lib/scene.ts) | The Zod contract for a scene, and the profile rules. The single source of truth for the editor, the server actions and the JSONB column. |
| [lib/geometry.ts](lib/geometry.ts) | Catmull-Rom curves, Ramer–Douglas–Peucker simplification, arc-length sampling, and the five-stroke notation vocabulary. |
| [lib/editor-store.ts](lib/editor-store.ts) | Zustand + zundo. Holds the scene, the step you are editing, undo/redo. |
| [components/board/](components/board/) | The SVG court, the board renderer, the playback loop, the editor, the read-only player. |
| [db/schema.ts](db/schema.ts) | `users`, `sessions`, and one `drills` table with a JSONB `scene`. |
| [lib/auth/](lib/auth/) | Email + password, bcrypt at cost 12, database-backed cookie sessions. |

### Why steps, not a timeline

Coaches think in steps — *"first the pass into the pivot, then the overlap"* — and steps
are far easier to edit, reorder, annotate and play back one at a time than a continuous
keyframe timeline. Each step stores its `moves` **and** the resting `positions` at its
end. That redundancy is deliberate: rendering any step is instant without replaying
history, and it survives a move being deleted.

### Why one JSONB column

The scene is always read and written whole, and its shape will move a dozen times while
the editor finds its feet. `schemaVersion` lives inside the document, so a migration is
a function rather than a DDL script. Every write goes through `validateScene`, and every
read is parsed on the way out — the column is never trusted.

## Auth

Email and password, on the coach side only. The player-facing `/b/[shareId]` link stays
public on purpose: an unguessable nanoid, no login, opened on a phone at the side of a
court. That link is the point of the product; a signup wall in front of it would defeat it.

Sessions are a random 32-byte token in an httpOnly cookie; the database stores only its
SHA-256, so a database leak hands nobody a working session. Expiry is 30 days, slid
forward once a session passes its halfway point.

## Where it stands

Built: the court and tokens, drag-to-record paths with the five line kinds, steps with
notes and durations, playback with scrub and speed, undo/redo, autosave to Postgres,
the library, and the public share link.

Not built yet: PNG/WebM export, the session builder that prints a training sheet,
reorderable step thumbnails, tags and filtering in the library, and ball attachment is
manual (pick the carrier in the token panel) rather than inferred.
