import { and, db, desc, eq, ne } from "@openstatus/db";
import { statusReport, statusReportUpdate } from "@openstatus/db/src/schema";
import { tool } from "ai";
import { z } from "zod";

export function createListStatusReportsTool(workspaceId: number) {
  return tool({
    description:
      "List status reports for this workspace. By default returns only active (non-resolved) reports. Use this to find existing reports when adding updates or editing.",
    inputSchema: z.object({
      filter: z
        .enum(["active", "all"])
        .optional()
        .describe(
          "Filter: 'active' for non-resolved reports (default), 'all' for everything",
        ),
    }),
    execute: async ({ filter = "active" }) => {
      const conditions = [eq(statusReport.workspaceId, workspaceId)];
      if (filter === "active") {
        conditions.push(ne(statusReport.status, "resolved"));
      }

      const reports = await db
        .select()
        .from(statusReport)
        .where(and(...conditions))
        .orderBy(desc(statusReport.updatedAt))
        .limit(20)
        .all();

      const result = await Promise.all(
        reports.map(async (r) => {
          const latestUpdate = await db
            .select({
              message: statusReportUpdate.message,
              status: statusReportUpdate.status,
              date: statusReportUpdate.date,
            })
            .from(statusReportUpdate)
            .where(eq(statusReportUpdate.statusReportId, r.id))
            .orderBy(desc(statusReportUpdate.date))
            .limit(1)
            .get();

          return {
            id: r.id,
            title: r.title,
            status: r.status,
            pageId: r.pageId,
            latestUpdate: latestUpdate
              ? {
                  message: latestUpdate.message,
                  status: latestUpdate.status,
                  date: latestUpdate.date?.toISOString() ?? null,
                }
              : null,
          };
        }),
      );

      return { reports: result };
    },
  });
}
