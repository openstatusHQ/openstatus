import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  allMonitorsSchema,
  insertMonitorSchema,
  monitor,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/plans";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const monitorLimit = allPlans.free.limits.monitors;
const periodicityLimit = allPlans.free.limits.periodicity;

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(z.object({ data: insertMonitorSchema, workspaceSlug: z.string() }))
    .mutation(async (opts) => {
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      // the user don't have access to this workspace
      if (!result || !result.users_to_workspaces) return;

      const monitorNumbers = (
        await opts.ctx.db.query.monitor.findMany({
          where: eq(monitor.workspaceId, currentWorkspace.id),
        })
      ).length;

      // the user has reached the limits
      if (monitorNumbers >= monitorLimit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your monitor limits.",
        });
      }

      // the user is not allowed to use the cron job
      if (
        opts.input.data?.periodicity &&
        !periodicityLimit.includes(opts.input.data?.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }

      await opts.ctx.db
        .insert(monitor)
        .values({
          ...opts.input.data,
          workspaceId: currentWorkspace.id,
        })
        .returning()
        .get();
    }),

  getMonitorByID: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const currentMonitor = await opts.ctx.db.query.monitor.findFirst({
        where: eq(monitor.id, opts.input.id),
      });

      if (!currentMonitor || !currentMonitor.workspaceId) return;
      // We make sure user as access to this workspace
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      return currentMonitor;
    }),

  updateMonitorDescription: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string(),
      }),
    )
    .mutation(async (opts) => {
      //  We make sure user as access to this workspace and the monitor
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.id))
        .get();

      if (!currentMonitor || !currentMonitor.workspaceId) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      await opts.ctx.db
        .update(monitor)
        .set({ description: opts.input.description })
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),
  updateMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      if (!opts.input.id) return;
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.id))
        .get();
      if (!currentMonitor || !currentMonitor.workspaceId) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      // the user is not allowed to use the cron job
      if (
        opts.input?.periodicity &&
        !periodicityLimit.includes(opts.input?.periodicity)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You reached your cron job limits.",
        });
      }

      await opts.ctx.db
        .update(monitor)
        .set(opts.input)
        .where(eq(monitor.id, opts.input.id))
        .returning()
        .get();
    }),
  updateMonitorStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: insertMonitorSchema.pick({ periodicity: true }),
      }),
    )
    .mutation(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.id))
        .get();
      if (!currentMonitor || !currentMonitor.workspaceId) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result.users_to_workspaces) return;

      await opts.ctx.db
        .update(monitor)
        .set(opts.input.status)
        .where(eq(monitor.id, opts.input.id))
        .run();
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.id))
        .get();
      if (!currentMonitor || !currentMonitor.workspaceId) return;

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentMonitor.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      await opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, currentMonitor.id))
        .run();
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");

      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();
      // the user don't have access to this workspace
      if (!result || !result.users_to_workspaces) return;

      const monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, currentWorkspace.id))
        .all();
      // const selectMonitorsArray = selectMonitorSchema.array();

      return allMonitorsSchema.parse(monitors);
    }),
});
