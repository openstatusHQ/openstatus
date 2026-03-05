import { and, db, desc, eq, gt } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";
import { tool } from "ai";
import { z } from "zod";

export function createListMaintenancesTool(workspaceId: number) {
  return tool({
    description:
      "List maintenance windows for this workspace. By default returns only upcoming maintenances. Use this to check existing scheduled maintenance.",
    inputSchema: z.object({
      filter: z
        .enum(["upcoming", "all"])
        .optional()
        .describe(
          "Filter: 'upcoming' for future maintenances (default), 'all' for everything",
        ),
    }),
    execute: async ({ filter = "upcoming" }) => {
      const conditions = [eq(maintenance.workspaceId, workspaceId)];
      if (filter === "upcoming") {
        conditions.push(gt(maintenance.from, new Date()));
      }

      const records = await db
        .select({
          id: maintenance.id,
          title: maintenance.title,
          message: maintenance.message,
          from: maintenance.from,
          to: maintenance.to,
          pageId: maintenance.pageId,
        })
        .from(maintenance)
        .where(and(...conditions))
        .orderBy(desc(maintenance.from))
        .limit(20)
        .all();

      return {
        maintenances: records.map((r) => ({
          id: r.id,
          title: r.title,
          message: r.message,
          from: r.from.toISOString(),
          to: r.to.toISOString(),
          pageId: r.pageId,
        })),
      };
    },
  });
}
