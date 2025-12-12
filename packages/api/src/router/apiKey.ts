import { UnkeyCore } from "@unkey/api/core";
import { apisListKeys } from "@unkey/api/funcs/apisListKeys";
import { keysCreateKey } from "@unkey/api/funcs/keysCreateKey";
import { keysDeleteKey } from "@unkey/api/funcs/keysDeleteKey";
import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { TRPCError } from "@trpc/server";
import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateAPI })
    .input(z.object({ ownerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });

      const allowedWorkspaces = await db
        .select()
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
        .where(eq(user.id, ctx.user.id))
        .all();

      const allowedIds = allowedWorkspaces.map((i) => i.workspace.id);

      if (!allowedIds.includes(input.ownerId)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        });
      }

      const res = await keysCreateKey(unkey, {
        apiId: env.UNKEY_API_ID,
        externalId: String(input.ownerId),
        prefix: "os",
      });

      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error.message,
        });
      }

      return res.value.data;
    }),

  revoke: protectedProcedure
    .meta({ track: Events.RevokeAPI })
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ input }) => {
      const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });

      const res = await keysDeleteKey(unkey, { keyId: input.keyId });

      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: res.error.message,
        });
      }

      return res.value;
    }),

  get: protectedProcedure.query(async ({ ctx }) => {
    const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });

    const res = await apisListKeys(unkey, {
      externalId: String(ctx.workspace.id),
      apiId: env.UNKEY_API_ID,
    });

    if (!res.ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: res.error.message,
      });
    }

    return res.value.data[0];
  }),
});
