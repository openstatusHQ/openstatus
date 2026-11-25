import { and, db as defaultDb, eq } from "@openstatus/db";
import { statusReport } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** Title and page of a report, or `undefined` when it is not in the workspace. */
export async function getStatusReportTitleInWorkspace(
  args: { workspaceId: number; statusReportId: number },
  db: DB = defaultDb,
): Promise<{ title: string; pageId: number | null } | undefined> {
  return db
    .select({ title: statusReport.title, pageId: statusReport.pageId })
    .from(statusReport)
    .where(
      and(
        eq(statusReport.workspaceId, args.workspaceId),
        eq(statusReport.id, args.statusReportId),
      ),
    )
    .get();
}
