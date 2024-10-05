import { z } from "zod";

import { and, desc, eq } from "@openstatus/db";
import { check, selectCheckSchema } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const checkRouter = createTRPCRouter({
  getChecksByWorkspace: protectedProcedure.query(async (opts) => {
    const checks = await opts.ctx.db
      .select()
      .from(check)
      .where(eq(check.workspaceId, opts.ctx.workspace.id))
      .orderBy(desc(check.createdAt))
      .all();
    return selectCheckSchema.array().parse(checks);
  }),
  getCheckById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const _check = await opts.ctx.db
        .select()
        .from(check)
        .where(
          and(
            eq(check.id, opts.input.id),
            eq(check.workspaceId, opts.ctx.workspace.id)
          )
        )
        .get();
      return selectCheckSchema.parse(_check);
    }),
});
