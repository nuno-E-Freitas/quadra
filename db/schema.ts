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

export type UserPreferences = {
  pitch?: {
    surface?: string;
    lines?: string;
    surround?: string;
    overlays?: string[];
    /** Hand-drawn court lines. Read back through the scene schema, never trusted. */
    marks?: unknown[];
  };
  /** What the two sides wear, since a club plays in the same kit every week. */
  pieces?: { home?: string; away?: string };
};

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
    /**
     * Per-coach defaults, read and written whole. JSONB rather than columns
     * because this will grow — the court's colours today, a preferred pitch
     * variant and step duration tomorrow — and none of it is ever queried on.
     */
    preferences: jsonb().$type<UserPreferences>(),
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
    /**
     * The setup every play of this type starts from — a whole scene with only
     * its first step, stored the same way a drill is and parsed the same way on
     * the way out. A defence always begins in the same shape; typing it out
     * again for every play is work the type already knows how to save.
     */
    template: jsonb().$type<Scene>(),
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
 * A one-time link that lets someone set a new password.
 *
 * Same shape as a session: the row holds only the SHA-256, so a leak of this
 * table hands nobody a working link. There is no email in this app — an
 * administrator issues the link and passes it on, which is the same trust
 * already needed to approve the account in the first place.
 */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Set on use, so a link that was already spent cannot be spent again. */
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
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

/**
 * Futsal is not football with fewer people: it is played in blocks that rotate
 * on and off together, and a coach thinks in those blocks before thinking in
 * individuals. A player belongs to at most one in a squad, which is what the
 * rotation means.
 */
export const quartets = pgTable(
  "quartets",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text().notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quartets_team_idx").on(t.teamId, t.position)],
);

export const quartetMembers = pgTable(
  "quartet_members",
  {
    quartetId: uuid()
      .notNull()
      .references(() => quartets.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.quartetId, t.userId] }),
    index("quartet_members_user_idx").on(t.userId),
  ],
);

export const ATTENDANCE = ["vou", "duvida", "nao"] as const;
export type Attendance = (typeof ATTENDANCE)[number];

/**
 * Who is coming on Tuesday.
 *
 * The weekly question of every amateur squad, and the one that decides what can
 * even be trained — there is no 4v4 with six people. It hangs off the training
 * rather than off a date of its own, so answering is the same act as opening the
 * link the coach already sends.
 */
export const attendance = pgTable(
  "attendance",
  {
    sessionId: uuid()
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text({ enum: ATTENDANCE }).notNull(),
    respondedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.userId] }),
    index("attendance_session_idx").on(t.sessionId),
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
    /**
     * Which block this one is for. Null means everyone — most of a session is.
     * Set null on delete so removing a block leaves the training standing.
     */
    quartetId: uuid().references(() => quartets.id, { onDelete: "set null" }),
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
export type Quartet = typeof quartets.$inferSelect;
