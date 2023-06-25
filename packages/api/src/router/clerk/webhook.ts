import { TRPCError } from "@trpc/server";
import * as z from "zod";

import { createTRPCRouter, publicProcedure } from "../../trpc";
import { user } from "@openstatus/db/src/schema";
import { clerkEvent } from ".";

const webhookProcedure = publicProcedure.input(
  z.object({
    data: clerkEvent,
  })
);

export const webhookRouter = createTRPCRouter({
  userCreated: webhookProcedure.mutation(async (opts) => {
    if (opts.input.data.type === "user.created") {
      await opts.ctx.db.insert(user).values({
        tenantId: opts.input.data.data.id,
      });
    }
  }),
});
