import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { z } from "zod";

import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { createTRPCRouter, publicProcedure } from "../../trpc";
import { stripe } from "./shared";

const webhookProcedure = publicProcedure.input(
  z.object({
    // From type Stripe.Event
    event: z.object({
      id: z.string(),
      account: z.string().nullish(),
      created: z.number(),
      data: z.object({
        object: z.record(z.any()),
      }),
      type: z.string(),
    }),
  }),
);

export const webhookRouter = createTRPCRouter({
  sessionCompleted: webhookProcedure.mutation(async (opts) => {
    const session = opts.input.event.data.object as Stripe.Checkout.Session;
    if (typeof session.subscription !== "string") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Missing or invalid subscription id",
      });
    }
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription,
    );
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    const result = await opts.ctx.db
      .select()
      .from(workspace)
      .where(eq(workspace.stripeId, customerId))
      .get();
    if (!result) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Workspace not found",
      });
    }
    await opts.ctx.db
      .update(workspace)
      .set({ plan: "pro" })
      .where(eq(workspace.id, result.id))
      .run();
  }),
});
