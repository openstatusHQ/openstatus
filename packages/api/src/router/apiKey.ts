import { z } from "zod";

import { Events } from "@openstatus/analytics";
import {
  CreateApiKeyInput,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "@openstatus/services/api-key";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateAPI })
    .input(CreateApiKeyInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { token, key } = await createApiKey({
          ctx: toServiceCtx(ctx),
          input,
        });
        // One-time plaintext display; caller's UI shows it once then drops it.
        return { token, key };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  revoke: protectedProcedure
    .meta({ track: Events.RevokeAPI })
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeApiKey({
          ctx: toServiceCtx(ctx),
          input: { id: input.keyId },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listApiKeys({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),
});
