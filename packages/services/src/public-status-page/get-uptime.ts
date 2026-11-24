import { inArray } from "@openstatus/db";
import { notExcused, pageComponent } from "@openstatus/db/src/schema";

import { dbOnlyContext, type DB, getReadDb } from "../context";
import { requirePageAccess, type PageVisitor } from "../page-access";
import {
  bySlugOrDomain,
  componentMonitorIds,
  countActivePrivateLocations,
} from "./internal";
import { PublicPageUptimeInput } from "./schemas";

/** The DB side of the uptime bars; the caller adds the Tinybird series. */
export async function getPublicStatusPageUptime(args: {
  input: PublicPageUptimeInput;
  visitor: PageVisitor;
  db?: DB;
}) {
  const input = PublicPageUptimeInput.parse(args.input);
  const db = getReadDb(dbOnlyContext(args.db));

  const page = await db.query.page.findFirst({
    where: bySlugOrDomain(input.slug),
    with: {
      maintenances: {
        with: {
          maintenancesToPageComponents: { with: { pageComponent: true } },
        },
      },
      statusReports: {
        with: {
          statusReportsToPageComponents: { with: { pageComponent: true } },
          statusReportUpdates: {
            with: { statusReportUpdateToPageComponents: true },
          },
        },
      },
      pageComponents: {
        where: inArray(pageComponent.id, input.pageComponentIds),
        with: {
          monitor: { with: { monitorIncidents: { where: notExcused } } },
        },
      },
    },
  });
  if (!page) return null;
  await requirePageAccess(page, args.visitor);

  const privateLocationCounts = await countActivePrivateLocations(
    db,
    componentMonitorIds(page.pageComponents),
  );
  return { page, privateLocationCounts };
}
