import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import { pageComponent } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** Names of the given components that belong to the workspace; others are absent. */
export async function getPageComponentNames(
  args: { workspaceId: number; ids: number[] },
  db: DB = defaultDb,
): Promise<Map<number, string>> {
  if (args.ids.length === 0) return new Map();
  const rows = await db
    .select({ id: pageComponent.id, name: pageComponent.name })
    .from(pageComponent)
    .where(
      and(
        eq(pageComponent.workspaceId, args.workspaceId),
        inArray(pageComponent.id, args.ids),
      ),
    )
    .all();
  return new Map(rows.map((r) => [r.id, r.name]));
}
