import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  allMonitorsSchema,
  insertMonitorSchema,
  monitor,
  monitorsToPages,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(opts.input.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      // the user don't have access to this workspace
      if (!result || !result.users_to_workspaces) return;

      await opts.ctx.db.insert(monitor).values(opts.input).returning().get();
    }),

  getMonitorById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const mon = await opts.ctx.db.query.monitor.findFirst({
        where: eq(monitor.id, opts.input.id),
      });

      if (!mon) return;
      // We make sure user as access to this workspace
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, Number(mon.workspaceId)))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      return mon;
    }),

  updateMonitorDescription: protectedProcedure
    .input(
      z.object({
        monitorId: z.number(),
        description: z.string(),
      }),
    )
    .mutation(async (opts) => {
      //  We make sure user as access to this workspace and the monitor
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.monitorId))
        .get();

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(currentMonitor.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      opts.ctx.db
        .update(monitor)
        .set({ description: opts.input.description })
        .where(eq(monitor.id, opts.input.monitorId));
    }),
  updateMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, Number(opts.input.id)))
        .get();

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(currentMonitor.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;

      opts.ctx.db
        .update(monitor)
        .set(opts.input)
        .where(eq(monitor.id, Number(opts.input.id)));
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

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(currentMonitor.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result.users_to_workspaces) return;

      await opts.ctx.db
        .update(monitor)
        .set(opts.input.status)
        .where(eq(monitor.id, opts.input.id));
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ monitorId: z.number() }))
    .mutation(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.monitorId))
        .get();

      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(currentMonitor.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result || !result.users_to_workspaces) return;
      // TODO: remove all the many-to-many relations to `pages`
      opts.ctx.db
        .delete(monitorsToPages)
        .where(eq(monitorsToPages.monitorId, opts.input.monitorId))
        .run();
      opts.ctx.db
        .delete(monitor)
        .where(eq(monitor.id, opts.input.monitorId))
        .run();
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number() }))
    .query(async (opts) => {
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(
          eq(usersToWorkspaces.workspaceId, Number(opts.input.workspaceId)),
        )
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();
      // the user don't have access to this workspace
      if (!result || !result.users_to_workspaces) return;

      const monitors = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.workspaceId, opts.input.workspaceId))
        .all();
      // const selectMonitorsArray = selectMonitorSchema.array();

      return allMonitorsSchema.parse(monitors);
    }),
});
