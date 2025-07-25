import { z } from "zod";

import { and, eq, inArray } from "@openstatus/db";
import { insertMonitorTagSchema, monitorTag } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const tagSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  color: z.string(),
});

export const monitorTagRouter = createTRPCRouter({
  getMonitorTagsByWorkspace: protectedProcedure.query(async (opts) => {
    return opts.ctx.db.query.monitorTag.findMany({
      where: eq(monitorTag.workspaceId, opts.ctx.workspace.id),
      with: { monitor: true },
    });
  }),

  update: protectedProcedure
    .input(insertMonitorTagSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;
      return await opts.ctx.db
        .update(monitorTag)
        .set({
          name: opts.input.name,
          color: opts.input.color,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(monitorTag.workspaceId, opts.ctx.workspace.id),
            eq(monitorTag.id, opts.input.id)
          )
        )
        .returning()
        .get();
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db
        .delete(monitorTag)
        .where(
          and(
            eq(monitorTag.id, opts.input.id),
            eq(monitorTag.workspaceId, opts.ctx.workspace.id)
          )
        )
        .run();
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string(), color: z.string() }))
    .mutation(async (opts) => {
      return opts.ctx.db
        .insert(monitorTag)
        .values({
          name: opts.input.name,
          color: opts.input.color,
          workspaceId: opts.ctx.workspace.id,
        })
        .returning()
        .get();
    }),

  // DASHBOARD

  list: protectedProcedure.query(async (opts) => {
    return opts.ctx.db.query.monitorTag.findMany({
      where: eq(monitorTag.workspaceId, opts.ctx.workspace.id),
      with: { monitor: true },
    });
  }),

  syncTags: protectedProcedure
    .input(z.array(tagSchema))
    .mutation(async (opts) => {
      const { ctx } = opts;
      const workspaceId = ctx.workspace.id;

      return await ctx.db.transaction(async (tx) => {
        // Get all existing tags for this workspace
        const existingTags = await tx.query.monitorTag.findMany({
          where: eq(monitorTag.workspaceId, workspaceId),
        });

        // Get IDs of tags that should be kept (have an ID in the input)
        const keepTagIds = new Set(
          opts.input
            .map((tag) => tag.id)
            .filter((id): id is number => id !== undefined)
        );

        // Delete tags that are not in the input
        const tagsToDelete = existingTags.filter(
          (tag) => !keepTagIds.has(tag.id)
        );
        if (tagsToDelete.length > 0) {
          await tx
            .delete(monitorTag)
            .where(
              and(
                eq(monitorTag.workspaceId, workspaceId),
                inArray(
                  monitorTag.id,
                  tagsToDelete.map((t) => t.id)
                )
              )
            )
            .run();
        }

        // Update or create tags
        const results = await Promise.all(
          opts.input.map(async (tag) => {
            if (tag.id) {
              // Update existing tag
              return tx
                .update(monitorTag)
                .set({
                  name: tag.name,
                  color: tag.color,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(monitorTag.workspaceId, workspaceId),
                    eq(monitorTag.id, tag.id)
                  )
                )
                .returning()
                .get();
            } else {
              // Create new tag
              return tx
                .insert(monitorTag)
                .values({
                  name: tag.name,
                  color: tag.color,
                  workspaceId,
                })
                .returning()
                .get();
            }
          })
        );

        console.error(results);

        return results;
      });
    }),
});
