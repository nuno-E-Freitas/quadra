import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { drillTypes } from "@/db/schema";

/** What most futsal coaches would type in anyway, offered as one click. */
export const SUGGESTED_TYPES = ["Ataque", "Defesa", "Bolas paradas", "Transição", "Pressão"];

/** The coach's own vocabulary: one squad's "bolas paradas" is another's
 *  "esquemas táticos", so the list is owned rather than global. */
export function listDrillTypes(ownerId: string) {
  return db
    .select({
      id: drillTypes.id,
      name: drillTypes.name,
      position: drillTypes.position,
      // Only whether there is one: the chips on the library do not need to
      // carry a whole scene each just to say "this type has a starting shape".
      hasTemplate: sql<boolean>`${drillTypes.template} is not null`,
    })
    .from(drillTypes)
    .where(eq(drillTypes.ownerId, ownerId))
    .orderBy(asc(drillTypes.position), asc(drillTypes.name));
}

/** The full templates, for showing a board or starting a play from one. */
export function listDrillTypeTemplates(ownerId: string) {
  return db
    .select({ id: drillTypes.id, name: drillTypes.name, template: drillTypes.template })
    .from(drillTypes)
    .where(eq(drillTypes.ownerId, ownerId))
    .orderBy(asc(drillTypes.position), asc(drillTypes.name));
}
