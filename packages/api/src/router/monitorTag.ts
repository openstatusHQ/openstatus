import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@openstatus/db";
import { insertMonitorTagSchema, monitorTag } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
        .set({ name: opts.input.name, color: opts.input.color })
        .where(
          and(
            eq(monitorTag.workspaceId, opts.ctx.workspace.id),
            eq(monitorTag.id, opts.input.id),
          ),
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
            eq(monitorTag.workspaceId, opts.ctx.workspace.id),
          ),
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
});
