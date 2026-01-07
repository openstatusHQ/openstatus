import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { createApiKeySchema } from "@openstatus/db/src/schema/api-keys/validation";

import { TRPCError } from "@trpc/server";
import {
  createApiKey as createCustomApiKey,
  getApiKeys,
  revokeApiKey,
} from "../service/apiKey";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateAPI })
    .input(createApiKeySchema)
    .mutation(async ({ input, ctx }) => {
      // Verify user has access to the workspace
      const allowedWorkspaces = await db
        .select()
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
        .where(eq(user.id, ctx.user.id))
        .all();

      const allowedIds = allowedWorkspaces.map((i) => i.workspace.id);

      if (!allowedIds.includes(ctx.workspace.id)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }

      // Create the API key using the custom service
      const { token, key } = await createCustomApiKey(
        ctx.workspace.id,
        ctx.user.id,
        input.name,
        input.description,
        input.expiresAt,
      );

      // Return both the key details and the full token (one-time display)
      return {
        token,
        key,
      };
    }),

  revoke: protectedProcedure
    .meta({ track: Events.RevokeAPI })
    .input(z.object({ keyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Revoke the key with workspace ownership verification
      const success = await revokeApiKey(input.keyId, ctx.workspace.id);

      if (!success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "API key not found or unauthorized",
        });
      }

      return { success: true };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    // Get all API keys for the workspace
    const keys = await getApiKeys(ctx.workspace.id);

    // Fetch user information for each key's creator
    const keysWithUserInfo = await Promise.all(
      keys.map(async (key) => {
        const creator = await db
          .select({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          })
          .from(user)
          .where(eq(user.id, key.createdById))
          .get();

        return {
          ...key,
          createdBy: creator,
        };
      }),
    );

    return keysWithUserInfo;
  }),
});
