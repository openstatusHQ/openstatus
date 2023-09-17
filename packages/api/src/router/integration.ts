import { z } from "zod";

import { and, eq, inArray } from "@openstatus/db";
import {
  insertIntegrationSchema,
  integration,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { hasUserAccessToWorkspace } from "./utils";

export const integrationRouter = createTRPCRouter({
  createIntegration: protectedProcedure
    .input(
      z.object({ workspaceSlug: z.string(), input: insertIntegrationSchema }),
    )
    .mutation(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;

      const exists = await opts.ctx.db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.workspaceId, result.workspace.id),
            eq(integration.externalId, opts.input.input.externalId),
          ),
        )
        .get();

      if (exists) {
        return;
      }
      await opts.ctx.db
        .insert(integration)
        .values({ ...opts.input.input, workspaceId: result.workspace.id })
        .returning()
        .get();
    }),
  getAllIntegrations: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;

      return await opts.ctx.db
        .select()
        .from(integration)
        .where(and(eq(integration.workspaceId, result.workspace.id)))
        .all();
    }),
  getIntegration: protectedProcedure
    .input(z.object({ workspaceSlug: z.string(), integrationId: z.string() }))
    .query(async (opts) => {
      const result = await hasUserAccessToWorkspace({
        workspaceSlug: opts.input.workspaceSlug,
        ctx: opts.ctx,
      });
      if (!result) return;

      return await opts.ctx.db
        .select()
        .from(integration)
        .where(
          and(
            eq(integration.workspaceId, result.workspace.id),
            eq(integration.id, Number(opts.input.integrationId)),
          ),
        )
        .get();
    }),
});
