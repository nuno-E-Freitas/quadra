# Quadra

A futsal tactics board that remembers the movement. Place players and the ball on a
40 × 20 m court, drag them, and every move leaves its path behind — then send a player
a link and they see where they go and where the ball goes, in order.

## Running it

```bash
pnpm install
[ -f .env ] || cp .env.example .env   # then set DATABASE_URL
pnpm db:migrate        # apply db/migrations
pnpm db:seed           # optional: demo@quadra.local / quadra-demo, plus one worked play
pnpm dev
```

`DATABASE_URL` takes either of two Postgres options:

- **Neon** — what `.env` points at now: the serverless branch in `eu-central-1`. Use the
  `-pooler` host and keep `sslmode=require`; postgres.js reads `sslmode` straight out of
  the URL, so the client in [db/index.ts](db/index.ts) needs no extra options.
- **Local Docker** — `pnpm db:up` brings up Postgres 17 from `docker-compose.yml` for
  working offline; the commented line in `.env` switches to it. It maps to host port
  **5434** because 5432 and 5433 were already taken on the dev machine.

`.env` is gitignored and stays that way: the Neon string is a live credential reachable
from anywhere, not a localhost password.

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
| [db/schema.ts](db/schema.ts) | Ten tables. `drills` carries the JSONB `scene`; the rest are accounts, squads and trainings. |
| [lib/auth/](lib/auth/) | Email + password, bcrypt at cost 12, database-backed cookie sessions, roles. |
| [lib/teams/](lib/teams/) | Squads, memberships, join codes, and publishing a drill to a squad. |
| [lib/trainings/](lib/trainings/) | A session: an ordered list of drills behind one share link. |
| [lib/export/record.ts](lib/export/record.ts) | Rasterises the live board frame by frame into an MP4/WebM file. |
| [lib/settings/](lib/settings/) | Per-coach preferences, kept as JSONB on the user. |
| [tests/](tests/) | `pnpm test` — the ball-carry rule and the court colours. |

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

## Accounts, squads and who sees what

Three platform roles. A **coach** owns a library, squads and trainings. A **player** owns
nothing and sees one page — everything published to a squad they belong to. An **admin**
can see and re-role every account. The team role sits on the *membership*, not the user,
so the same person can coach one squad and play in another.

A squad is joined through a reusable code that lives for 14 days: one link pasted into the
group chat rather than fifteen invitations. Accepting is a POST — prefetching the link
enrols nobody — and an account created through an invite takes its role from that invite.

Publishing is deliberately separate from the share link. `/b/[shareId]` stays public and
unguessable for anyone you paste it to, no login, opened on a phone at the side of a
court — that link is the point of the product and a signup wall in front of it would
defeat it. *Publishing* is the other half: it makes a drill appear, without any link, in
the trainings of everyone in the squad.

Authorization lives in the data-access layer and in each server action, never only in a
layout — a layout does not re-render on navigation and does not gate the segments below
it. Sessions are a random 32-byte token in an httpOnly cookie; the database stores only
its SHA-256, so a leak hands nobody a working session. Expiry is 30 days, slid forward
past halfway, and a disabled account is refused at the session check, so switching it off
kills a live cookie immediately rather than at its expiry.

## Trainings and types

A **training** is an ordered list of drills with one link (`/t/[shareId]`), a date and an
optional squad — the thing a coach actually sends. Each item shows a still of its setup,
so a player sees the shape before deciding to open anything.

**Types** are the coach's own vocabulary — ataque, defesa, bolas paradas — used to filter
the library. Deleting a type does not delete its plays: `type_id` is `ON DELETE SET NULL`,
so they become untyped and can be reclassified.

## Video export

The board already on screen is rasterised frame by frame while ordinary playback runs,
and fed to `MediaRecorder`. The alternative — a second renderer drawing straight to a
canvas — would mean every change to a token, a trace or the pitch had to be made twice,
in two languages, forever. MP4 is preferred over WebM because it is what WhatsApp, iOS
and Android all accept without converting.

## Where it stands

Built: the court and tokens, drag-to-record paths with the five line kinds, steps with
notes and durations, playback with scrub, speed (0.25x–2x) and step-at-a-time, undo/redo,
autosave to Postgres, the library with named plays and type filtering, deleting a play,
the public share link, accounts with roles, squads with join codes, publishing to a
squad, the player feed, trainings behind one link, video export, a recolourable court
with per-coach defaults, and a Portuguese interface.

The ball is carried by whoever is standing over it: a ball within 1.5 m of a player is at
his feet, and moving him takes it along. An explicit attachment still overrides proximity.

Not built yet: PNG export, a printable training sheet, reorderable step thumbnails, and
ball attachment is manual (pick the carrier in the token panel) rather than inferred.
The `tags` column on `drills` is still unused — types took the job it was added for.
