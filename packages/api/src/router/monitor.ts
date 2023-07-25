import { customAlphabet, urlAlphabet } from "nanoid";
import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  allMonitorsSchema,
  insertMonitorSchema,
  monitor,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(z.object({ data: insertMonitorSchema, workspaceId: z.string() }))
    .mutation(async (opts) => {
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, opts.input.workspaceId))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      // the user don't have access to this workspace
      if (!result || !result.users_to_workspaces) return;
      const nanoid = customAlphabet(urlAlphabet, 10);
      const { id, ...values } = opts.input.data;

      await opts.ctx.db
        .insert(monitor)
        .values({
          id: nanoid(),
          ...values,
          workspaceId: opts.input.workspaceId,
        })
        .returning()
        .get();
    }),

  getMonitorById: protectedProcedure
    .input(z.object({ id: z.string() }))
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
        monitorId: z.string(),
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

      opts.ctx.db
        .update(monitor)
        .set({ description: opts.input.description })
        .where(eq(monitor.id, opts.input.monitorId));
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
        id: z.string(),
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
        .where(eq(monitor.id, opts.input.id));
    }),

  deleteMonitor: protectedProcedure
    .input(z.object({ monitorId: z.string() }))
    .mutation(async (opts) => {
      const currentMonitor = await opts.ctx.db
        .select()
        .from(monitor)
        .where(eq(monitor.id, opts.input.monitorId))
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
        .where(eq(monitor.id, opts.input.monitorId))
        .run();
    }),
  getMonitorsByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async (opts) => {
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, opts.input.workspaceId))
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
