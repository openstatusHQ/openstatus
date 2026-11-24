import { eq } from "@openstatus/db";
import { notExcused, page } from "@openstatus/db/src/schema";

import { type DB, dbOnlyContext, getReadDb } from "../context";

/**
 * What the public status badge computes from: the open incidents of the page's
 * active monitors, its unresolved reports and its ongoing maintenances.
 * `null` for a missing or non-public page.
 */
export async function getPublicPageStatusInputs(args: {
  slug: string;
  now?: Date;
  db?: DB;
}) {
  const db = getReadDb(dbOnlyContext(args.db));
  const row = await db.query.page.findFirst({
    where: eq(page.slug, args.slug),
    with: {
      pageComponents: {
        with: {
          monitor: { with: { monitorIncidents: { where: notExcused } } },
        },
      },
      statusReports: true,
      maintenances: true,
    },
  });
  if (!row || row.accessType !== "public") return null;

  const now = args.now ?? new Date();
  const incidents = row.pageComponents
    .filter(
      (c) =>
        c.type === "monitor" &&
        c.monitor &&
        c.monitor.active &&
        !c.monitor.deletedAt,
    )
    .flatMap(
      (c) =>
        c.monitor?.monitorIncidents?.filter((inc) => !inc.resolvedAt) ?? [],
    );
  return {
    incidents,
    statusReports: row.statusReports.filter((r) => r.status !== "resolved"),
    maintenances: row.maintenances.filter((m) => m.from <= now && m.to >= now),
  };
}
