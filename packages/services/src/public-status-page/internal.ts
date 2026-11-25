import { sql } from "@openstatus/db";
import { notExcused, page } from "@openstatus/db/src/schema";

import type { DB } from "../context";

// A host reaches its page through either the slug or the custom domain. Most
// pages store "" as their custom domain, so "" must never match it.
export const matchesSlugOrDomain = (
  t: Pick<typeof page, "slug" | "customDomain">,
  slug: string,
) =>
  sql`lower(${t.slug}) = ${slug} OR (${t.customDomain} != '' AND lower(${t.customDomain}) = ${slug})`;

/** Relational `where`: relational queries alias the table, so it resolves columns late. */
export const bySlugOrDomain = (slug: string) => ({
  RAW: (t: Pick<typeof page, "slug" | "customDomain">) =>
    matchesSlugOrDomain(t, slug),
});

export function findPageBySlug(db: DB, slug: string) {
  return db.select().from(page).where(matchesSlugOrDomain(page, slug)).get();
}

/** Everything a rendered status page shows, ordered for display. */
export function findPageTree(db: DB, slug: string) {
  return db.query.page.findFirst({
    where: bySlugOrDomain(slug),
    with: {
      workspace: true,
      statusReports: {
        with: {
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
            with: { statusReportUpdateToPageComponents: true },
          },
          statusReportsToPageComponents: { with: { pageComponent: true } },
        },
      },
      maintenances: {
        with: {
          maintenanceUpdates: {
            orderBy: (updates, { desc }) => [
              desc(updates.date),
              desc(updates.id),
            ],
          },
          maintenancesToPageComponents: { with: { pageComponent: true } },
        },
        orderBy: (maintenances, { desc }) => desc(maintenances.from),
      },
      pageComponents: {
        with: {
          monitor: {
            with: { monitorIncidents: { where: notExcused } },
          },
          group: true,
        },
        orderBy: (pageComponents, { asc }) => asc(pageComponents.order),
      },
      pageComponentGroups: true,
    },
  });
}

export type PublicPageTree = NonNullable<
  Awaited<ReturnType<typeof findPageTree>>
>;

/** Denied visitors still get the page chrome (login, layout, OG), never its content. */
export function withoutGatedContent(tree: PublicPageTree): PublicPageTree {
  return {
    ...tree,
    statusReports: [],
    maintenances: [],
    pageComponents: [],
    pageComponentGroups: [],
  };
}

/** Active private-location assignments per monitor; monitors without one are absent. */
export async function countActivePrivateLocations(
  db: DB,
  monitorIds: number[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (monitorIds.length === 0) return counts;
  const rows = await db.query.privateLocationToMonitors.findMany({
    where: { monitorId: { in: monitorIds }, deletedAt: { isNull: true } },
    columns: { monitorId: true },
  });
  for (const row of rows) {
    if (row.monitorId === null) continue;
    counts.set(row.monitorId, (counts.get(row.monitorId) ?? 0) + 1);
  }
  return counts;
}

export function componentMonitorIds(
  components: { monitorId: number | null }[],
): number[] {
  return [
    ...new Set(
      components.flatMap((c) => (c.monitorId === null ? [] : [c.monitorId])),
    ),
  ];
}
