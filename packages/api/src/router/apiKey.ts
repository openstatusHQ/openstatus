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

// Router-level input shape: the dashboard form doesn't send `createdById`
// (the service needs it; we pull it off ctx). Omit it here so zod doesn't
// insist the client provide a user id.
const CreateApiKeyRouterInput = CreateApiKeyInput.omit({ createdById: true });

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateAPI })
    .input(CreateApiKeyRouterInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { token, key } = await createApiKey({
          ctx: toServiceCtx(ctx),
          input: { ...input, createdById: ctx.user.id },
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
