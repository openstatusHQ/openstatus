import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  insertPageComponentSchema,
  monitor,
  monitorGroup,
  page,
  pageComponent,
  selectMonitorGroupSchema,
  selectMonitorSchema,
  selectPageComponentSchema,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const pageComponentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ pageId: z.number() }))
    .query(async (opts) => {
      // Verify page belongs to workspace
      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      const components = await opts.ctx.db.query.pageComponent.findMany({
        where: eq(pageComponent.pageId, opts.input.pageId),
        with: {
          monitor: true,
          monitorGroup: true,
        },
        orderBy: (components, { asc }) => [asc(components.order)],
      });

      return z
        .array(
          selectPageComponentSchema.extend({
            monitor: selectMonitorSchema.nullish(),
            monitorGroup: selectMonitorGroupSchema.nullish(),
          }),
        )
        .parse(components);
    }),

  create: protectedProcedure
    .input(insertPageComponentSchema)
    .mutation(async (opts) => {
      const { workspaceId, ...input } = opts.input;

      // Verify page belongs to workspace
      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, input.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      // If type is monitor, verify the monitor belongs to workspace
      if (input.type === "monitor" && input.monitorId) {
        const _monitor = await opts.ctx.db.query.monitor.findFirst({
          where: and(
            eq(monitor.id, input.monitorId),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (!_monitor) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Monitor not found or you don't have access to it.",
          });
        }
      }

      const newComponent = await opts.ctx.db
        .insert(pageComponent)
        .values({
          ...input,
          workspaceId: opts.ctx.workspace.id,
        })
        .returning()
        .get();

      return selectPageComponentSchema.parse(newComponent);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().nullish(),
        order: z.number().optional(),
        monitorGroupId: z.number().nullish(),
        groupOrder: z.number().optional(),
      }),
    )
    .mutation(async (opts) => {
      // Verify component belongs to workspace
      const existingComponent = await opts.ctx.db.query.pageComponent.findFirst(
        {
          where: eq(pageComponent.id, opts.input.id),
          with: { page: true },
        },
      );

      if (
        !existingComponent ||
        existingComponent.page?.workspaceId !== opts.ctx.workspace.id
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Component not found",
        });
      }

      const { id, ...updateData } = opts.input;

      await opts.ctx.db
        .update(pageComponent)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(pageComponent.id, id))
        .run();
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      // Verify component belongs to workspace
      const existingComponent = await opts.ctx.db.query.pageComponent.findFirst(
        {
          where: eq(pageComponent.id, opts.input.id),
          with: { page: true },
        },
      );

      if (
        !existingComponent ||
        existingComponent.page?.workspaceId !== opts.ctx.workspace.id
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Component not found",
        });
      }

      // Delete the component (status reports will be reassigned at page level via cascade)
      await opts.ctx.db
        .delete(pageComponent)
        .where(eq(pageComponent.id, opts.input.id))
        .run();
    }),

  updateAll: protectedProcedure
    .input(
      z.object({
        pageId: z.number(),
        components: z.array(
          z.object({
            id: z.number().optional(), // undefined for new components
            type: z.enum(["external", "monitor"]),
            name: z.string(),
            description: z.string().nullish(),
            monitorId: z.number().nullish(),
            order: z.number(),
            groupId: z.number().nullish(),
            groupOrder: z.number().optional(),
          }),
        ),
        groups: z.array(
          z.object({
            order: z.number(),
            name: z.string(),
            components: z.array(
              z.object({
                id: z.number().optional(),
                type: z.enum(["external", "monitor"]),
                name: z.string(),
                description: z.string().nullish(),
                monitorId: z.number().nullish(),
                order: z.number(),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async (opts) => {
      // Verify page belongs to workspace
      const _page = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!_page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      // Collect all monitor IDs to validate
      const monitorIds = [
        ...opts.input.components
          .filter((c) => c.type === "monitor" && c.monitorId)
          .map((c) => c.monitorId as number),
        ...opts.input.groups.flatMap((g) =>
          g.components
            .filter((c) => c.type === "monitor" && c.monitorId)
            .map((c) => c.monitorId as number),
        ),
      ];

      if (monitorIds.length > 0) {
        const monitors = await opts.ctx.db.query.monitor.findMany({
          where: and(
            inArray(monitor.id, monitorIds),
            eq(monitor.workspaceId, opts.ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        });

        if (monitors.length !== monitorIds.length) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to all the monitors.",
          });
        }
      }

      await opts.ctx.db.transaction(async (tx) => {
        // Delete existing components for this page
        await tx
          .delete(pageComponent)
          .where(eq(pageComponent.pageId, opts.input.pageId));

        // Delete existing groups for this page
        await tx
          .delete(monitorGroup)
          .where(eq(monitorGroup.pageId, opts.input.pageId));

        // Create groups first
        if (opts.input.groups.length > 0) {
          const createdGroups = await tx
            .insert(monitorGroup)
            .values(
              opts.input.groups.map((g) => ({
                workspaceId: opts.ctx.workspace.id,
                pageId: opts.input.pageId,
                name: g.name,
              })),
            )
            .returning();

          // Create components within groups
          for (let i = 0; i < opts.input.groups.length; i++) {
            const group = opts.input.groups[i];
            const createdGroup = createdGroups[i];

            if (group.components.length > 0) {
              await tx.insert(pageComponent).values(
                group.components.map((c) => ({
                  workspaceId: opts.ctx.workspace.id,
                  pageId: opts.input.pageId,
                  type: c.type,
                  name: c.name,
                  description: c.description,
                  monitorId: c.monitorId,
                  order: group.order,
                  monitorGroupId: createdGroup.id,
                  groupOrder: c.order,
                })),
              );
            }
          }
        }

        // Create ungrouped components
        if (opts.input.components.length > 0) {
          await tx.insert(pageComponent).values(
            opts.input.components.map((c) => ({
              workspaceId: opts.ctx.workspace.id,
              pageId: opts.input.pageId,
              type: c.type,
              name: c.name,
              description: c.description,
              monitorId: c.monitorId,
              order: c.order,
              monitorGroupId: c.groupId,
              groupOrder: c.groupOrder ?? 0,
            })),
          );
        }
      });
    }),
});
