import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Scene } from "@/lib/scene";

export const USER_ROLES = ["admin", "coach", "player"] as const;
export const TEAM_ROLES = ["coach", "player"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type TeamRole = (typeof TEAM_ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
    /**
     * Platform-wide standing. `coach` is the default because a bare signup is
     * someone starting their own squad; joining through an invite can lower it
     * to `player`. `admin` is the only role that sees every account.
     */
    role: text({ enum: USER_ROLES }).notNull().default("coach"),
    /** Set instead of deleting, so their drills and authorship survive. */
    disabledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/**
 * `id` is the SHA-256 of the cookie token, never the token itself — a database
 * leak then does not hand anyone a working session.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const drillTypes = pgTable(
  "drill_types",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** Where it sits in the coach's own list, not alphabetical order. */
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("drill_types_owner_name_key").on(t.ownerId, t.name),
    index("drill_types_owner_idx").on(t.ownerId, t.position),
  ],
);

/**
 * One table, JSONB scene. The scene is always read and written whole, and its
 * shape will move a dozen times while the editor finds its feet — `schemaVersion`
 * inside the document makes migration a function, not a DDL script.
 */
export const drills = pgTable(
  "drills",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text({ enum: ["play", "training"] }).notNull(),
    /**
     * The coach's own category — ataque, defesa, bolas paradas. Nullable and
     * set null on delete, so removing a type reclassifies its plays rather than
     * destroying them.
     */
    typeId: uuid().references(() => drillTypes.id, { onDelete: "set null" }),
    title: text().notNull(),
    description: text(),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    scene: jsonb().$type<Scene>().notNull(),
    /** nanoid, unguessable, for the player-facing /b/[shareId] link. */
    shareId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("drills_share_id_key").on(t.shareId),
    index("drills_owner_updated_idx").on(t.ownerId, t.updatedAt.desc()),
    index("drills_owner_type_idx").on(t.ownerId, t.typeId),
    index("drills_tags_idx").using("gin", t.tags),
  ],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teams_owner_idx").on(t.ownerId)],
);

/** Who is in a squad and in what capacity. The composite key makes a person
 *  unrepeatable within one team while leaving them free to join others. */
export const memberships = pgTable(
  "memberships",
  {
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: TEAM_ROLES }).notNull(),
    /** Shirt number, shown in the squad list. Free text: "7", "GR", "—". */
    number: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index("memberships_user_idx").on(t.userId),
  ],
);

/**
 * A join link, reusable until it expires — a coach pastes one code into the
 * squad's group chat rather than inviting fifteen people one at a time.
 */
export const invites = pgTable(
  "invites",
  {
    code: text().primaryKey(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text({ enum: TEAM_ROLES }).notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invites_team_idx").on(t.teamId)],
);

/** A drill a coach has pushed to a squad. Absence means players cannot see it,
 *  even though the unguessable /b/ link still works for anyone holding it. */
export const publications = pgTable(
  "publications",
  {
    drillId: uuid()
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.drillId, t.teamId] }),
    index("publications_team_idx").on(t.teamId, t.publishedAt.desc()),
  ],
);

/**
 * An ordered bill of drills for one training — the thing a coach actually hands
 * the squad. Named `training_sessions` because `sessions` is already the auth
 * table; the two have nothing to do with each other.
 */
export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid().references(() => teams.id, { onDelete: "set null" }),
    title: text().notNull(),
    description: text(),
    scheduledFor: timestamp({ withTimezone: true }),
    /** nanoid, for the one link that replaces sending eight separate ones. */
    shareId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("training_sessions_share_id_key").on(t.shareId),
    index("training_sessions_owner_idx").on(t.ownerId, t.updatedAt.desc()),
  ],
);

export const trainingSessionItems = pgTable(
  "training_session_items",
  {
    sessionId: uuid()
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    drillId: uuid()
      .notNull()
      .references(() => drills.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    /** What the coach wants said about this drill in this training. */
    note: text(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.drillId] }),
    index("training_session_items_order_idx").on(t.sessionId, t.position),
  ],
);

export type User = typeof users.$inferSelect;
export type Drill = typeof drills.$inferSelect;
export type DrillType = typeof drillTypes.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type TrainingSession = typeof trainingSessions.$inferSelect;
