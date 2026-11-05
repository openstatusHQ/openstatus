import { Events } from "@openstatus/analytics";
import { sendOwnershipTransferred } from "@openstatus/emails";
import {
  ListMembersInput,
  deleteMember,
  listMembers,
  transferOwnership,
} from "@openstatus/services/member";
import { z } from "zod";

import { createAfterResponse } from "../lib/after-response";
import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { syncCustomerEmailToNewOwner } from "./stripe/shared";

const afterResponse = createAfterResponse("ownership transfer follow-up");

export const memberRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListMembersInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listMembers({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.RemoveUser })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMember({
          ctx: toServiceCtx(ctx),
          input: { userId: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  transferOwnership: protectedProcedure
    .meta({ track: Events.TransferOwnership })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      let result: Awaited<ReturnType<typeof transferOwnership>>;
      try {
        result = await transferOwnership({
          ctx: toServiceCtx(ctx),
          input: { userId: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }

      // The transfer is committed; the follow-ups run after the response
      // and only log on failure.
      const { newOwnerEmail } = result;
      const formerOwnerEmail = ctx.user.email || null;
      const { workspace } = ctx;

      afterResponse(() =>
        sendOwnershipTransferred({
          idempotencyKey: `ownership:${workspace.id}:${result.toUserId}:${Date.now()}`,
          workspaceName: workspace.name || workspace.slug,
          newOwner: newOwnerEmail,
          formerOwner: formerOwnerEmail || ctx.user.name || "A workspace owner",
          to: { new: newOwnerEmail, former: formerOwnerEmail },
        }),
      );

      const { stripeId } = workspace;
      if (stripeId && formerOwnerEmail) {
        afterResponse(() =>
          syncCustomerEmailToNewOwner({
            customerId: stripeId,
            formerOwnerEmail,
            newOwnerEmail,
          }),
        );
      }
    }),
});
