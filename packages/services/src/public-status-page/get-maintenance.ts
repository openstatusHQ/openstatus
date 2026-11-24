import { and, eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import { requirePageAccess, type PageVisitor } from "../page-access";
import { findPageBySlug } from "./internal";
import { PublicPageEntityInput } from "./schemas";

export async function getPublicMaintenance(args: {
  input: PublicPageEntityInput;
  visitor: PageVisitor;
  db?: DB;
}) {
  const input = PublicPageEntityInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await findPageBySlug(db, input.slug);
  if (!page) return null;
  await requirePageAccess(page, args.visitor);

  const row = await db.query.maintenance.findFirst({
    where: and(eq(maintenance.id, input.id), eq(maintenance.pageId, page.id)),
    with: {
      maintenanceUpdates: {
        orderBy: (updates, { desc }) => [desc(updates.date), desc(updates.id)],
      },
      maintenancesToPageComponents: {
        with: { pageComponent: { with: { monitor: true } } },
      },
    },
  });
  return row ?? null;
}
