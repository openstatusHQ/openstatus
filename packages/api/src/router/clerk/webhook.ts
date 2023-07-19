import * as z from "zod";

import { eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { createTRPCRouter, publicProcedure } from "../../trpc";
import { clerkEvent } from "./type";

export const webhookProcedure = publicProcedure.input(
  z.object({
    data: clerkEvent,
  }),
);

export const webhookRouter = createTRPCRouter({
  userCreated: webhookProcedure.mutation(async (opts) => {
    if (opts.input.data.type === "user.created") {
      // There's no primary key with drizzle I checked the tennant is not already in the database
      const alreadyExists = await opts.ctx.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.tenantId, opts.input.data.data.id))
        .run();
      if (alreadyExists.rows.length) return;

      const userResult = await opts.ctx.db
        .insert(user)
        .values({
          tenantId: opts.input.data.data.id,
        })
        .returning({ id: user.id })
        .run();
      const workspaceResult = await opts.ctx.db
        .insert(workspace)
        .values({ name: "" })
        .returning({ id: workspace.id })
        .run();
      await opts.ctx.db
        .insert(usersToWorkspaces)
        .values({
          userId: Number(userResult.lastInsertRowid),
          workspaceId: Number(workspaceResult.lastInsertRowid),
        })
        .run();
    }
  }),
  userUpdated: webhookProcedure.mutation(async (opts) => {
    if (opts.input.data.type === "user.updated") {
      // We should do something
    }
  }),
});

export const clerkRouter = createTRPCRouter({
  webhooks: webhookRouter,
});
