import { z } from "zod";

import { Events } from "@openstatus/analytics";
import { and, eq } from "@openstatus/db";
import {
  selectUserSchema,
  usersToWorkspaces,
  workspaceRole,
} from "@openstatus/db/src/schema";

import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const memberRouter = createTRPCRouter({
  list: protectedProcedure.query(async (opts) => {
    const result = await opts.ctx.db.query.usersToWorkspaces.findMany({
      where: eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
      with: {
        user: true,
      },
    });

    return z
      .object({
        role: z.enum(workspaceRole),
        createdAt: z.coerce.date(),
        user: selectUserSchema,
      })
      .array()
      .parse(result);
  }),

  delete: protectedProcedure
    .meta({ track: Events.RemoveUser })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const currentUser = await opts.ctx.db.query.usersToWorkspaces.findFirst({
        where: and(
          eq(usersToWorkspaces.userId, opts.ctx.user.id),
          eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!currentUser) throw new Error("No user to workspace found");

      if (!["owner"].includes(currentUser.role)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Not authorized to remove user from workspace",
        });
      }

      if (opts.input.id === opts.ctx.user.id) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot remove yourself from workspace",
        });
      }

      await opts.ctx.db
        .delete(usersToWorkspaces)
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, opts.ctx.workspace.id),
            eq(usersToWorkspaces.userId, opts.input.id),
          ),
        );
    }),
});
