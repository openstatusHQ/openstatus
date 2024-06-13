import { z } from "zod";

import { and, eq } from "@openstatus/db";
import {
  insertIntegrationSchema,
  integration,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const integrationRouter = createTRPCRouter({
  createIntegration: protectedProcedure
    .input(
      z.object({ workspaceSlug: z.string(), input: insertIntegrationSchema }),
    )
    .mutation(async (opts) => {
      const exists = await opts.ctx.db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.workspaceId, opts.ctx.workspace.id),
            eq(integration.externalId, opts.input.input.externalId),
          ),
        )
        .get();

      if (exists) {
        return;
      }
      await opts.ctx.db
        .insert(integration)
        .values({ ...opts.input.input, workspaceId: opts.ctx.workspace.id })
        .returning()
        .get();
    }),
});
