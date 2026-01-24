import { z } from "zod";

import { type SQL, and, asc, desc, eq, inArray, sql } from "@openstatus/db";
import { pageComponent, pageComponentGroup } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageComponentRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _pageComponent = await opts.ctx.db
        .select()
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.id, opts.input.id),
            eq(pageComponent.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();

      return _pageComponent;
    }),

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

      const query = opts.ctx.db.query.pageComponent.findMany({
        where: and(...whereConditions),
        orderBy:
          opts.input?.order === "desc"
            ? desc(pageComponent.order)
            : asc(pageComponent.order),
        with: {
          monitor: true,
          group: true,
        },
      });

      const result = await query;

      return result;
    }),

  delete: protectedProcedure
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

  new: protectedProcedure
    .input(
      z.object({
        pageId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["external", "monitor"]).default("monitor"),
        monitorId: z.number().optional(),
        order: z.number().optional(),
        groupId: z.number().optional(),
      }),
    )
    .mutation(async (opts) => {
      const newPageComponent = await opts.ctx.db
        .insert(pageComponent)
        .values({
          pageId: opts.input.pageId,
          workspaceId: opts.ctx.workspace.id,
          name: opts.input.name,
          description: opts.input.description,
          type: opts.input.type,
          monitorId: opts.input.monitorId,
          order: opts.input.order,
          groupId: opts.input.groupId,
        })
        .returning()
        .get();

      return newPageComponent;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["external", "monitor"]).optional(),
        monitorId: z.number().optional(),
        order: z.number().optional(),
        groupId: z.number().optional(),
      }),
    )
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(pageComponent.id, opts.input.id),
        eq(pageComponent.workspaceId, opts.ctx.workspace.id),
      ];

      const _pageComponent = await opts.ctx.db
        .update(pageComponent)
        .set({
          name: opts.input.name,
          description: opts.input.description,
          type: opts.input.type,
          monitorId: opts.input.monitorId,
          order: opts.input.order,
          groupId: opts.input.groupId,
          updatedAt: new Date(),
        })
        .where(and(...whereConditions))
        .returning()
        .get();

      return _pageComponent;
    }),

  updateOrder: protectedProcedure
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
            type: z.enum(["monitor", "external"]),
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
                type: z.enum(["monitor", "external"]),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
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

        // Collect IDs for external components that have IDs in input
        const inputExternalComponentIds = [
          ...opts.input.components
            .filter((c) => c.type === "external" && c.id)
            .map((c) => c.id),
          ...opts.input.groups.flatMap((g) =>
            g.components
              .filter((c) => c.type === "external" && c.id)
              .map((c) => c.id),
          ),
        ] as number[];

        // Find components that are being removed
        // For monitor components: those with monitorIds not in the input
        // For external components with IDs: those with IDs not in the input
        // For external components without IDs in input: delete all existing external components
        const removedMonitorComponents = existingComponents.filter(
          (c) =>
            c.type === "monitor" &&
            c.monitorId &&
            !inputMonitorIds.includes(c.monitorId),
        );

        const hasExternalComponentsInInput =
          opts.input.components.some((c) => c.type === "external") ||
          opts.input.groups.some((g) =>
            g.components.some((c) => c.type === "external"),
          );

        // If input has external components but they don't have IDs, we need to delete old ones
        // If input has external components with IDs, only delete those not in input
        const removedExternalComponents = existingComponents.filter((c) => {
          if (c.type !== "external") return false;
          // If we have external components in input
          if (hasExternalComponentsInInput) {
            // If the input has IDs, only remove those not in the list
            if (inputExternalComponentIds.length > 0) {
              return !inputExternalComponentIds.includes(c.id);
            }
            // If input doesn't have IDs, remove all existing external components
            return true;
          }
          // If no external components in input at all, remove existing ones
          return true;
        });

        const removedComponentIds = [
          ...removedMonitorComponents.map((c) => c.id),
          ...removedExternalComponents.map((c) => c.id),
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

        // Separate monitor and external components for different upsert strategies
        const monitorComponents = allComponentValues.filter(
          (c) => c.type === "monitor" && c.monitorId,
        );
        const externalComponents = allComponentValues.filter(
          (c) => c.type === "external",
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

        // Handle external components
        // If they have IDs, update them; otherwise insert new ones
        for (const componentValue of externalComponents) {
          if (componentValue.id) {
            // Update existing external component (preserves ID and relationships)
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
            // Insert new external component
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
