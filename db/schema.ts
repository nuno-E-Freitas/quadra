import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Scene } from "@/lib/scene";

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    name: text().notNull(),
    passwordHash: text().notNull(),
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
    index("drills_tags_idx").using("gin", t.tags),
  ],
);

export type User = typeof users.$inferSelect;
export type Drill = typeof drills.$inferSelect;
