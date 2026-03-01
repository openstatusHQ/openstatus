import { z } from "zod";

import { type SQL, and, asc, desc, eq, inArray, sql } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  selectMaintenanceSchema,
  selectMonitorSchema,
  selectPageComponentGroupSchema,
  selectPageComponentSchema,
  selectStatusReportSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageComponentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z
        .object({
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(pageComponent.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.pageId) {
        whereConditions.push(eq(pageComponent.pageId, opts.input.pageId));
      }

      const result = await opts.ctx.db.query.pageComponent.findMany({
        where: and(...whereConditions),
        orderBy:
          opts.input?.order === "desc"
            ? desc(pageComponent.order)
            : asc(pageComponent.order),
        with: {
          monitor: true,
          group: true,
          statusReportsToPageComponents: {
            with: {
              statusReport: true,
            },
            orderBy: (statusReportsToPageComponents, { desc }) =>
              desc(statusReportsToPageComponents.createdAt),
          },
          maintenancesToPageComponents: {
            with: {
              maintenance: true,
            },
            orderBy: (maintenancesToPageComponents, { desc }) =>
              desc(maintenancesToPageComponents.createdAt),
          },
        },
      });

      // Transform and parse the result to flatten the junction tables
      return selectPageComponentSchema
        .extend({
          monitor: selectMonitorSchema.nullish(),
          group: selectPageComponentGroupSchema.nullish(),
          statusReports: z.array(selectStatusReportSchema).default([]),
          maintenances: z.array(selectMaintenanceSchema).default([]),
        })
        .array()
        .parse(
          result.map((component) => ({
            ...component,
            statusReports:
              component.statusReportsToPageComponents?.map(
                (sr) => sr.statusReport,
              ) ?? [],
            maintenances:
              component.maintenancesToPageComponents?.map(
                (m) => m.maintenance,
              ) ?? [],
          })),
        );
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeletePageComponent, trackProps: ["id"] })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      return await opts.ctx.db
        .delete(pageComponent)
        .where(
          and(
            eq(pageComponent.id, opts.input.id),
            eq(pageComponent.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning();
    }),

  updateOrder: protectedProcedure
    .meta({ track: Events.UpdatePageComponentOrder, trackProps: ["pageId"] })
    .input(
      z.object({
        pageId: z.number(),
        components: z.array(
          z.object({
            id: z.number().optional(), // Optional for new components
            monitorId: z.number().nullish(),
            order: z.number(),
            name: z.string(),
            description: z.string().nullish(),
            type: z.enum(["monitor", "static"]),
          }),
        ),
        groups: z.array(
          z.object({
            order: z.number(),
            name: z.string(),
            components: z.array(
              z.object({
                id: z.number().optional(), // Optional for new components
                monitorId: z.number().nullish(),
                order: z.number(),
                name: z.string(),
                description: z.string().nullish(),
                type: z.enum(["monitor", "static"]),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
        // Verify the page belongs to the current workspace
        const ownedPage = await tx
          .select({ id: page.id })
          .from(page)
          .where(
            and(
              eq(page.id, opts.input.pageId),
              eq(page.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .get();

        if (!ownedPage) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this page.",
          });
        }

        const pageComponentLimit = opts.ctx.workspace.limits["page-components"];

        // Get existing state
        const existingComponents = await tx
          .select()
          .from(pageComponent)
          .where(
            and(
              eq(pageComponent.pageId, opts.input.pageId),
              eq(pageComponent.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .all();

        if (existingComponents.length >= pageComponentLimit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You reached your page component limits.",
          });
        }

        const existingGroups = await tx
          .select()
          .from(pageComponentGroup)
          .where(
            and(
              eq(pageComponentGroup.pageId, opts.input.pageId),
              eq(pageComponentGroup.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .all();

        const existingGroupIds = existingGroups.map((g) => g.id);

        // Collect all monitorIds from input (for monitor-type components)
        const inputMonitorIds = [
          ...opts.input.components
            .filter((c) => c.type === "monitor" && c.monitorId)
            .map((c) => c.monitorId),
          ...opts.input.groups.flatMap((g) =>
            g.components
              .filter((c) => c.type === "monitor" && c.monitorId)
              .map((c) => c.monitorId),
          ),
        ] as number[];

        if (inputMonitorIds.length > 0) {
          const validMonitors = await tx.query.monitor.findMany({
            where: and(
              eq(monitor.workspaceId, opts.ctx.workspace.id),
              inArray(monitor.id, inputMonitorIds),
            ),
          });
          if (validMonitors.length !== inputMonitorIds.length) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Invalid monitor IDs.",
            });
          }
        }

        // Collect IDs for static components that have IDs in input
        const inputStaticComponentIds = [
          ...opts.input.components
            .filter((c) => c.type === "static" && c.id)
            .map((c) => c.id),
          ...opts.input.groups.flatMap((g) =>
            g.components
              .filter((c) => c.type === "static" && c.id)
              .map((c) => c.id),
          ),
        ] as number[];

        // Find components that are being removed
        // For monitor components: those with monitorIds not in the input
        // For static components with IDs: those with IDs not in the input
        // For static components without IDs in input: delete all existing static components
        const removedMonitorComponents = existingComponents.filter(
          (c) =>
            c.type === "monitor" &&
            c.monitorId &&
            !inputMonitorIds.includes(c.monitorId),
        );

        const hasStaticComponentsInInput =
          opts.input.components.some((c) => c.type === "static") ||
          opts.input.groups.some((g) =>
            g.components.some((c) => c.type === "static"),
          );

        // If input has static components but they don't have IDs, we need to delete old ones
        // If input has static components with IDs, only delete those not in input
        const removedStaticComponents = existingComponents.filter((c) => {
          if (c.type !== "static") return false;
          // If we have static components in input
          if (hasStaticComponentsInInput) {
            // If the input has IDs, only remove those not in the list
            if (inputStaticComponentIds.length > 0) {
              return !inputStaticComponentIds.includes(c.id);
            }
            // If input doesn't have IDs, remove all existing static components
            return true;
          }
          // If no static components in input at all, remove existing ones
          return true;
        });

        const removedComponentIds = [
          ...removedMonitorComponents.map((c) => c.id),
          ...removedStaticComponents.map((c) => c.id),
        ];

        // Delete removed components
        if (removedComponentIds.length > 0) {
          await tx
            .delete(pageComponent)
            .where(
              and(
                eq(pageComponent.pageId, opts.input.pageId),
                eq(pageComponent.workspaceId, opts.ctx.workspace.id),
                inArray(pageComponent.id, removedComponentIds),
              ),
            );
        }

        // Clear groupId from all components before deleting groups
        // This prevents foreign key constraint errors
        if (existingGroupIds.length > 0) {
          await tx
            .update(pageComponent)
            .set({ groupId: null })
            .where(
              and(
                eq(pageComponent.pageId, opts.input.pageId),
                eq(pageComponent.workspaceId, opts.ctx.workspace.id),
                inArray(pageComponent.groupId, existingGroupIds),
              ),
            );
        }

        // Delete old groups and create new ones
        if (existingGroupIds.length > 0) {
          await tx
            .delete(pageComponentGroup)
            .where(
              and(
                eq(pageComponentGroup.pageId, opts.input.pageId),
                eq(pageComponentGroup.workspaceId, opts.ctx.workspace.id),
              ),
            );
        }

        // Create new groups
        const newGroups: Array<{ id: number; name: string }> = [];
        if (opts.input.groups.length > 0) {
          const createdGroups = await tx
            .insert(pageComponentGroup)
            .values(
              opts.input.groups.map((g) => ({
                pageId: opts.input.pageId,
                workspaceId: opts.ctx.workspace.id,
                name: g.name,
              })),
            )
            .returning();
          newGroups.push(...createdGroups);
        }

        // Prepare values for upsert - both grouped and ungrouped components
        const groupComponentValues = opts.input.groups.flatMap((g, i) =>
          g.components.map((c) => ({
            id: c.id, // Will be undefined for new components
            pageId: opts.input.pageId,
            workspaceId: opts.ctx.workspace.id,
            name: c.name,
            description: c.description,
            type: c.type,
            monitorId: c.monitorId,
            order: g.order,
            groupId: newGroups[i].id,
            groupOrder: c.order,
          })),
        );

        const standaloneComponentValues = opts.input.components.map((c) => ({
          id: c.id, // Will be undefined for new components
          pageId: opts.input.pageId,
          workspaceId: opts.ctx.workspace.id,
          name: c.name,
          description: c.description,
          type: c.type,
          monitorId: c.monitorId,
          order: c.order,
          groupId: null as number | null,
          groupOrder: null as number | null,
        }));

        const allComponentValues = [
          ...groupComponentValues,
          ...standaloneComponentValues,
        ];

        // Separate monitor and static components for different upsert strategies
        const monitorComponents = allComponentValues.filter(
          (c) => c.type === "monitor" && c.monitorId,
        );
        const staticComponents = allComponentValues.filter(
          (c) => c.type === "static",
        );

        // Upsert monitor components using SQL-level conflict resolution
        // This uses the (pageId, monitorId) unique constraint to preserve component IDs
        if (monitorComponents.length > 0) {
          await tx
            .insert(pageComponent)
            .values(monitorComponents)
            .onConflictDoUpdate({
              target: [pageComponent.pageId, pageComponent.monitorId],
              set: {
                name: sql.raw("excluded.`name`"),
                description: sql.raw("excluded.`description`"),
                order: sql.raw("excluded.`order`"),
                groupId: sql.raw("excluded.`group_id`"),
                groupOrder: sql.raw("excluded.`group_order`"),
                updatedAt: sql`(strftime('%s', 'now'))`,
              },
            });
        }

        // Handle static components
        // If they have IDs, update them; otherwise insert new ones
        for (const componentValue of staticComponents) {
          if (componentValue.id) {
            // Update existing static component (preserves ID and relationships)
            await tx
              .update(pageComponent)
              .set({
                name: componentValue.name,
                description: componentValue.description,
                type: componentValue.type,
                monitorId: componentValue.monitorId,
                order: componentValue.order,
                groupId: componentValue.groupId,
                groupOrder: componentValue.groupOrder,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(pageComponent.id, componentValue.id),
                  eq(pageComponent.pageId, opts.input.pageId),
                  eq(pageComponent.workspaceId, opts.ctx.workspace.id),
                ),
              );
          } else {
            // Insert new static component
            await tx.insert(pageComponent).values({
              pageId: componentValue.pageId,
              workspaceId: componentValue.workspaceId,
              name: componentValue.name,
              description: componentValue.description,
              type: componentValue.type,
              monitorId: componentValue.monitorId,
              order: componentValue.order,
              groupId: componentValue.groupId,
              groupOrder: componentValue.groupOrder,
            });
          }
        }
      });

      return { success: true };
    }),
});
