import * as z from "zod";

import { user } from "@openstatus/db/src/schema";

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
      await opts.ctx.db.insert(user).values({
        tenantId: opts.input.data.data.id,
      });
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
