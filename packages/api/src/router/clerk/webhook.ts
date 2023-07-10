import * as z from "zod";

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
        .from(user);

      if (alreadyExists.length) return;

      const userResult = await opts.ctx.db
        .insert(user)
        .values({
          tenantId: opts.input.data.data.id,
        })
        .execute();
      const workspaceResult = await opts.ctx.db.insert(workspace).values({});

      await opts.ctx.db
        .insert(usersToWorkspaces)
        .values({
          userId: Number(userResult.insertId),
          workspaceId: Number(workspaceResult.insertId),
        })
        .execute();
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
