import { Unkey } from "@unkey/api";
import { z } from "zod";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { env } from "../env";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const unkey = new Unkey({ token: env.UNKEY_TOKEN, cache: "no-cache" });

export const apiKeyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ ownerId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const allowedWorkspaces = await db
        .select()
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
        .where(eq(user.id, ctx.user.id))
        .all();

      const allowedIds = allowedWorkspaces.map((i) => i.workspace.id);

      if (!allowedIds.includes(input.ownerId)) {
        throw new Error("Unauthorized");
      }

      const key = await unkey.keys.create({
        apiId: env.UNKEY_API_ID,
        ownerId: String(input.ownerId),
        prefix: "os",
      });

      console.log(key);

      return key;
    }),

  revoke: protectedProcedure
    .input(z.object({ keyId: z.string() }))
    .mutation(async ({ input }) => {
      const res = await unkey.keys.delete({ keyId: input.keyId });
      return res;
    }),

  get: protectedProcedure.query(async ({ ctx }) => {
    const data = await unkey.apis.listKeys({
      apiId: env.UNKEY_API_ID,
      ownerId: String(ctx.workspace.id),
    });

    if (data?.error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong. Please contact us.",
      });
    }

    const value = data.result.keys?.[0] || null;

    return value;
  }),
});
