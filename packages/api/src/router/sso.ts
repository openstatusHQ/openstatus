import {
  CreateSsoPortalLinkInput,
  createSsoPortalLink,
  disableSso,
  enableSso,
  getSsoConfig,
} from "@openstatus/services/sso";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const ssoRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getSsoConfig({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  enable: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await enableSso({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  disable: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await disableSso({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  // A mutation rather than a query: portal links expire five minutes after
  // creation, so they must not be prefetched or cached.
  portalLink: protectedProcedure
    .input(CreateSsoPortalLinkInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSsoPortalLink({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
