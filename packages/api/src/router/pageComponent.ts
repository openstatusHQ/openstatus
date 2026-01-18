import { z } from "zod";

import { type SQL, and, asc, desc, eq } from "@openstatus/db";
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
            monitorId: z.number().nullish(),
            order: z.number(),
            name: z.string(),
            type: z.enum(["monitor", "external"]),
          }),
        ),
        groups: z.array(
          z.object({
            order: z.number(),
            name: z.string(),
            components: z.array(
              z.object({
                monitorId: z.number().nullish(),
                order: z.number(),
                name: z.string(),
                type: z.enum(["monitor", "external"]),
              }),
            ),
          }),
        ),
      }),
    )
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
        // Delete all existing components for this page first (due to foreign key)
        await tx
          .delete(pageComponent)
          .where(
            and(
              eq(pageComponent.pageId, opts.input.pageId),
              eq(pageComponent.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .run();

        // Then delete all existing groups for this page
        await tx
          .delete(pageComponentGroup)
          .where(
            and(
              eq(pageComponentGroup.pageId, opts.input.pageId),
              eq(pageComponentGroup.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .run();

        // Create standalone components
        for (const component of opts.input.components) {
          await tx
            .insert(pageComponent)
            .values({
              pageId: opts.input.pageId,
              workspaceId: opts.ctx.workspace.id,
              name: component.name,
              type: component.type,
              monitorId: component.monitorId,
              order: component.order,
              groupId: null,
              groupOrder: null,
            })
            .run();
        }

        // Create groups and their components
        for (const group of opts.input.groups) {
          // Create the group
          const newGroup = await tx
            .insert(pageComponentGroup)
            .values({
              pageId: opts.input.pageId,
              workspaceId: opts.ctx.workspace.id,
              name: group.name,
            })
            .returning()
            .get();

          // Create components in the group
          for (const component of group.components) {
            await tx
              .insert(pageComponent)
              .values({
                pageId: opts.input.pageId,
                workspaceId: opts.ctx.workspace.id,
                name: component.name,
                type: component.type,
                monitorId: component.monitorId,
                order: group.order,
                groupId: newGroup.id,
                groupOrder: component.order,
              })
              .run();
          }
        }
      });

      return { success: true };
    }),
});
